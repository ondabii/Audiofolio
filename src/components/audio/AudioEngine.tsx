'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAudioStore } from '@/store/audioStore';

// 모듈 레벨 캐시 (컴포넌트 리렌더 시 유지)
const audioBufferCache = new Map<string, AudioBuffer>();

export function AudioEngine({ trackVersions = [] }: { trackVersions: any[] }) {
  const { playingVersionId, isPlaying, updateVersionState, setGlobalCurrentTime } = useAudioStore();

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
  const gainNodesRef = useRef<Map<string, GainNode>>(new Map());
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  // 버퍼 로드가 끝나면 재생해야 할 버전 ID를 임시 저장
  const pendingPlayIdRef = useRef<string | null>(null);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      sourceNodesRef.current.forEach(node => { try { node.stop(); } catch (e) {} });
      if (audioCtxRef.current?.state !== 'closed') {
        audioCtxRef.current?.close();
      }
    };
  }, []);

  // AudioContext lazy init — 브라우저 autoplay 정책: user gesture 이후에만 생성
  const getAudioCtx = useCallback((): AudioContext => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  // ─── 재생 동기화 루프 ───
  const syncLoop = useCallback(() => {
    const store = useAudioStore.getState();
    const ctx = audioCtxRef.current;
    if (!ctx || !store.playingVersionId || !store.isPlaying) return;

    const buf = audioBufferCache.get(store.playingVersionId);
    if (buf) {
      const elapsed = ctx.currentTime - startTimeRef.current;
      setGlobalCurrentTime(elapsed % buf.duration);
    }
    animationFrameRef.current = requestAnimationFrame(syncLoop);
  }, [setGlobalCurrentTime]);

  // ─── 실제 재생 시작 (분리된 함수) ───
  const startPlayback = useCallback((versionId: string, offset: number = 0) => {
    const ctx = getAudioCtx();
    const buf = audioBufferCache.get(versionId);
    if (!ctx || !buf) return;

    // 기존 재생 중 노드 전부 정리
    cancelAnimationFrame(animationFrameRef.current);
    sourceNodesRef.current.forEach(node => { try { node.stop(); } catch (e) {} });
    sourceNodesRef.current.clear();
    gainNodesRef.current.clear();

    if (ctx.state === 'suspended') ctx.resume();

    const sourceNode = ctx.createBufferSource();
    sourceNode.buffer = buf;
    sourceNode.loop = true;

    const gainNode = ctx.createGain();
    gainNode.gain.value = 1;
    sourceNode.connect(gainNode);
    gainNode.connect(ctx.destination);

    const safeOffset = offset % buf.duration;
    sourceNode.start(0, safeOffset);
    startTimeRef.current = ctx.currentTime - safeOffset;

    sourceNodesRef.current.set(versionId, sourceNode);
    gainNodesRef.current.set(versionId, gainNode);

    animationFrameRef.current = requestAnimationFrame(syncLoop);
  }, [getAudioCtx, syncLoop]);

  // ─── 오디오 로드 & 디코딩 ───
  const loadAndDecodeAudio = useCallback(async (version: any): Promise<AudioBuffer | null> => {
    if (!version?.id || !version?.audio_url) return null;

    // 캐시 히트
    if (audioBufferCache.has(version.id)) {
      const cached = audioBufferCache.get(version.id)!;
      updateVersionState(version.id, { isReady: true, durationMs: cached.duration * 1000 });

      // 재생 대기 중이었다면 즉시 재생
      if (pendingPlayIdRef.current === version.id) {
        pendingPlayIdRef.current = null;
        if (useAudioStore.getState().isPlaying) {
          startPlayback(version.id, pauseTimeRef.current);
        }
      }
      return cached;
    }

    updateVersionState(version.id, { isReady: false });

    try {
      // 서버 프록시를 통해 CORS 없이 R2 오디오 로드
      const audioUrl = `/api/audio-url?key=${encodeURIComponent(version.audio_url)}`;
      const response = await fetch(audioUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const arrayBuffer = await response.arrayBuffer();
      const ctx = getAudioCtx();
      const decodedData = await ctx.decodeAudioData(arrayBuffer);

      audioBufferCache.set(version.id, decodedData);
      updateVersionState(version.id, { isReady: true, durationMs: decodedData.duration * 1000 });

      // 로드 완료 — 재생 대기 중이었다면 즉시 재생
      if (pendingPlayIdRef.current === version.id) {
        pendingPlayIdRef.current = null;
        if (useAudioStore.getState().isPlaying) {
          startPlayback(version.id, pauseTimeRef.current);
        }
      }

      return decodedData;
    } catch (e) {
      console.error('[AudioEngine] 오디오 디코딩 실패:', version.id, e);
      updateVersionState(version.id, { isReady: false });
      return null;
    }
  }, [updateVersionState, getAudioCtx, startPlayback]);

  // ─── playingVersionId 변경 시: N, N+1, N-1 순차 버퍼링 ───
  useEffect(() => {
    if (!playingVersionId) return;

    const currentTrack = trackVersions.find(v => v.id === playingVersionId);
    const trackSiblings = trackVersions
      .filter(v => v.track_id === currentTrack?.track_id)
      .sort((a, b) => a.order_index - b.order_index);

    const idx = trackSiblings.findIndex(v => v.id === playingVersionId);
    if (idx === -1) return;

    // N 우선 로드
    loadAndDecodeAudio(trackSiblings[idx]).then(() => {
      // N+1, N-1 순차 사전 로드
      const preload = async () => {
        if (idx + 1 < trackSiblings.length) await loadAndDecodeAudio(trackSiblings[idx + 1]);
        if (idx - 1 >= 0) await loadAndDecodeAudio(trackSiblings[idx - 1]);
      };
      preload();
    });
  }, [playingVersionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Seek 처리 ───
  const { seekRequestTime, clearSeekRequest } = useAudioStore();

  useEffect(() => {
    if (seekRequestTime === null || !isPlaying || !playingVersionId) return;

    const buf = audioBufferCache.get(playingVersionId);
    if (buf) {
      const offset = seekRequestTime % buf.duration;
      pauseTimeRef.current = offset;
      startPlayback(playingVersionId, offset);
      clearSeekRequest();
    }
  }, [seekRequestTime, isPlaying, playingVersionId, startPlayback, clearSeekRequest]);

  // ─── 재생 / 일시정지 처리 ───
  useEffect(() => {
    // Seek 처리 중이면 간섭 방지
    if (useAudioStore.getState().seekRequestTime !== null) return;

    if (isPlaying && playingVersionId) {
      const buf = audioBufferCache.get(playingVersionId);
      if (buf) {
        // 버퍼 준비 완료 → 즉시 재생
        startPlayback(playingVersionId, pauseTimeRef.current);
      } else {
        // 버퍼 아직 로드 중 → 완료 시 자동 재생 예약
        pendingPlayIdRef.current = playingVersionId;
      }
    } else {
      // 일시정지
      cancelAnimationFrame(animationFrameRef.current);
      const ctx = audioCtxRef.current;
      if (ctx && playingVersionId && audioBufferCache.has(playingVersionId)) {
        const buf = audioBufferCache.get(playingVersionId)!;
        const elapsed = ctx.currentTime - startTimeRef.current;
        pauseTimeRef.current = elapsed % buf.duration;
      }
      sourceNodesRef.current.forEach(node => { try { node.stop(); } catch (e) {} });
      sourceNodesRef.current.clear();
      pendingPlayIdRef.current = null;
    }
  }, [isPlaying, playingVersionId, startPlayback]);

  return null;
}
