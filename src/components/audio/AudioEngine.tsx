'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAudioStore } from '@/store/audioStore';

// Web Audio API 기반 병렬 디코딩 캐시
const audioBufferCache = new Map<string, AudioBuffer>();

export function AudioEngine({ trackVersions = [] }: { trackVersions: any[] }) {
  const { playingVersionId, isPlaying, updateVersionState, setGlobalCurrentTime } = useAudioStore();
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
  const gainNodesRef = useRef<Map<string, GainNode>>(new Map());
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);

  // 초기화
  useEffect(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      sourceNodesRef.current.forEach(node => {
        try { node.stop(); } catch(e){}
      });
      if (audioCtxRef.current?.state !== 'closed') {
        audioCtxRef.current?.close();
      }
    };
  }, []);

  // 오디오 로드 및 디코딩 함수
  const loadAndDecodeAudio = async (version: any) => {
    if (!audioCtxRef.current) return;
    if (audioBufferCache.has(version.id)) {
      updateVersionState(version.id, { isReady: true, durationMs: audioBufferCache.get(version.id)!.duration * 1000 });
      return audioBufferCache.get(version.id);
    }
    
    updateVersionState(version.id, { isReady: false });
    
    try {
      const audioUrl = version.public_url || '/placeholder.mp3'; // Fallback for local testing
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const decodedData = await audioCtxRef.current.decodeAudioData(arrayBuffer);
      
      audioBufferCache.set(version.id, decodedData);
      updateVersionState(version.id, { isReady: true, durationMs: decodedData.duration * 1000 });
      
      return decodedData;
    } catch (e) {
      console.error('Failed to decode audio for version:', version.id, e);
      return null;
    }
  };

  // N-1, N+1 큐잉 로직
  useEffect(() => {
    if (!playingVersionId) return;

    // 현재 재생 중인 버전이 속한 트랙 찾기
    const currentTrackVersions = trackVersions.filter(v => 
      v.track_id === trackVersions.find(tv => tv.id === playingVersionId)?.track_id
    ).sort((a, b) => a.order_index - b.order_index);

    if (currentTrackVersions.length === 0) return;

    const currentIndex = currentTrackVersions.findIndex(v => v.id === playingVersionId);
    
    // N (현재) 우선 로딩
    loadAndDecodeAudio(currentTrackVersions[currentIndex]).then(() => {
      // 로드 완료 후 N+1, N-1 순차 로딩 (병렬로 넘기지 않고 순차 처리하여 네트워크 최적화)
      const loadNeighbors = async () => {
        // N+1
        if (currentIndex + 1 < currentTrackVersions.length) {
          await loadAndDecodeAudio(currentTrackVersions[currentIndex + 1]);
        }
        // N-1
        if (currentIndex - 1 >= 0) {
          await loadAndDecodeAudio(currentTrackVersions[currentIndex - 1]);
        }
      };
      loadNeighbors();
    });

  }, [playingVersionId, trackVersions, updateVersionState]);

  // 재생 동기화 관리 루프
  const syncLoop = useCallback(() => {
    if (!audioCtxRef.current || !playingVersionId || !isPlaying) return;

    const ctx = audioCtxRef.current;
    const currentBuffer = audioBufferCache.get(playingVersionId);
    
    if (currentBuffer) {
      // 재생 경과 시간 계산
      const elapsed = ctx.currentTime - startTimeRef.current;
      const currentPos = elapsed % currentBuffer.duration;
      
      setGlobalCurrentTime(currentPos);
    }
    
    animationFrameRef.current = requestAnimationFrame(syncLoop);
  }, [playingVersionId, isPlaying, setGlobalCurrentTime]);

  // Seek(탐색) 처리
  const { seekRequestTime, clearSeekRequest } = useAudioStore();
  
  useEffect(() => {
    if (seekRequestTime !== null && isPlaying && playingVersionId) {
      const ctx = audioCtxRef.current;
      const targetBuffer = audioBufferCache.get(playingVersionId);
      if (ctx && targetBuffer) {
        // 기존 재생 중지
        sourceNodesRef.current.forEach(node => {
          try { node.stop(); } catch(e){}
        });
        sourceNodesRef.current.clear();
        gainNodesRef.current.clear();

        const offset = seekRequestTime % targetBuffer.duration;
        pauseTimeRef.current = offset;

        // 새 소스 노드로 재시작
        const sourceNode = ctx.createBufferSource();
        sourceNode.buffer = targetBuffer;
        sourceNode.loop = true;

        const gainNode = ctx.createGain();
        gainNode.gain.value = 1;

        sourceNode.connect(gainNode);
        gainNode.connect(ctx.destination);

        sourceNode.start(0, offset);
        startTimeRef.current = ctx.currentTime - offset;

        sourceNodesRef.current.set(playingVersionId, sourceNode);
        gainNodesRef.current.set(playingVersionId, gainNode);
        
        clearSeekRequest();
      }
    }
  }, [seekRequestTime, isPlaying, playingVersionId, clearSeekRequest]);

  // 재생/정지/크로스페이드 처리
  useEffect(() => {
    // Seek 요청 중일 때는 일반 재생 로직이 간섭하지 않도록 방어
    if (useAudioStore.getState().seekRequestTime !== null) return;

    const ctx = audioCtxRef.current;
    if (!ctx) return;

    if (isPlaying && ctx.state === 'suspended') {
      ctx.resume();
    }

    if (isPlaying) {
      // 모든 재생 중인 노드 정리 (MVP: 새로 Source Node를 만들어 스케줄링)
      sourceNodesRef.current.forEach(node => {
        try { node.stop(); } catch(e){}
      });
      sourceNodesRef.current.clear();
      gainNodesRef.current.clear();

      const targetBuffer = audioBufferCache.get(playingVersionId || '');
      if (!targetBuffer) {
        return;
      }

      const sourceNode = ctx.createBufferSource();
      sourceNode.buffer = targetBuffer;
      sourceNode.loop = true; // Gapless Loop 지원

      const gainNode = ctx.createGain();
      gainNode.gain.value = 1;

      sourceNode.connect(gainNode);
      gainNode.connect(ctx.destination);

      const offset = pauseTimeRef.current % targetBuffer.duration;
      sourceNode.start(0, offset);

      startTimeRef.current = ctx.currentTime - offset;
      
      sourceNodesRef.current.set(playingVersionId!, sourceNode);
      gainNodesRef.current.set(playingVersionId!, gainNode);

      animationFrameRef.current = requestAnimationFrame(syncLoop);
      
    } else {
      // 일시 정지 처리
      cancelAnimationFrame(animationFrameRef.current);
      if (playingVersionId && audioBufferCache.has(playingVersionId)) {
        const buffer = audioBufferCache.get(playingVersionId)!;
        const elapsed = ctx.currentTime - startTimeRef.current;
        pauseTimeRef.current = elapsed % buffer.duration;
      }
      
      sourceNodesRef.current.forEach(node => {
        try { node.stop(); } catch(e){}
      });
      sourceNodesRef.current.clear();
    }
  }, [isPlaying, playingVersionId, syncLoop]);

  return null;
}
