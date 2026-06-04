'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAudioStore } from '@/store/audioStore';

/**
 * 오디오 재생 엔진 — <audio> 엘리먼트 기반
 *
 * Web Audio API(AudioContext)는 브라우저 Autoplay 정책으로 인한
 * 복잡한 타이밍 문제가 있어, 신뢰성 높은 <audio> 엘리먼트로 대체.
 * 파형 시각화는 waveform_data(DB)를 사용하므로 AudioContext 불필요.
 */
export function AudioEngine({ trackVersions = [] }: { trackVersions: any[] }) {
  const {
    playingVersionId,
    isPlaying,
    seekRequestTime,
    setGlobalCurrentTime,
    updateVersionState,
    clearSeekRequest,
  } = useAudioStore();

  const audioCtxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<Record<string, AudioBuffer>>({});
  
  // 현재 동시 가동 중인 오디오 노드 레프
  const sourcesRef = useRef<Record<string, AudioBufferSourceNode>>({});
  const gainsRef = useRef<Record<string, GainNode>>({});
  
  // 마스터 볼륨 게인 노드 레프
  const masterGainRef = useRef<GainNode | null>(null);

  // 타임라인 계산 레프
  const startTimeRef = useRef<number>(0);
  const startOffsetRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  // 현재 기동된 버전 ID들 및 재생 여부 레프
  const activeVersionIdsRef = useRef<string[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  
  // 비동기 재생 경합 조건 Abort를 위한 태스크 ID 레프
  const playTaskIdRef = useRef<number>(0);

  // ─── 단일 AudioContext 초기화 ───
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  // ─── 마스터 게인 노드 초기화 및 획득 ───
  const getMasterGain = useCallback(() => {
    const ctx = getAudioContext();
    if (!masterGainRef.current) {
      masterGainRef.current = ctx.createGain();
      masterGainRef.current.gain.setValueAtTime(useAudioStore.getState().volume, ctx.currentTime);
      masterGainRef.current.connect(ctx.destination);
    }
    return masterGainRef.current;
  }, [getAudioContext]);

  // ─── 시간 동기화 루프 ───
  const stopSync = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  const startSync = useCallback((maxDuration: number) => {
    stopSync();
    const tick = () => {
      const ctx = audioCtxRef.current;
      if (ctx && isPlayingRef.current && maxDuration > 0) {
        const elapsed = ctx.currentTime - startTimeRef.current;
        const current = (elapsed + startOffsetRef.current) % maxDuration;
        setGlobalCurrentTime(current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopSync, setGlobalCurrentTime]);

  // ─── 활성 오디오 소스 노드 클린업 ───
  const stopAllSources = useCallback(() => {
    // 진행 중인 비동기 로딩 취소
    playTaskIdRef.current++;

    stopSync();
    Object.keys(sourcesRef.current).forEach(id => {
      try {
        sourcesRef.current[id].stop();
        sourcesRef.current[id].disconnect();
      } catch (e) {}
    });
    sourcesRef.current = {};

    Object.keys(gainsRef.current).forEach(id => {
      try {
        gainsRef.current[id].disconnect();
      } catch (e) {}
    });
    gainsRef.current = {};
    activeVersionIdsRef.current = [];
  }, [stopSync]);

  // 언마운트 정리
  useEffect(() => {
    return () => {
      stopAllSources();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, [stopAllSources]);

  // ─── 오디오 바이너리 fetch 및 AudioBuffer 디코딩 캐시 ───
  const loadAudioBuffer = useCallback(async (version: any): Promise<AudioBuffer> => {
    const id = version.id;
    if (buffersRef.current[id]) {
      return buffersRef.current[id];
    }

    updateVersionState(id, { isReady: false });
    const url = `/api/audio-url?key=${encodeURIComponent(version.audio_url)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP 에러: ${res.status}`);

    const arrayBuffer = await res.arrayBuffer();
    const ctx = getAudioContext();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    
    buffersRef.current[id] = audioBuffer;
    
    const durationMs = version.duration_ms > 0 
      ? version.duration_ms 
      : Math.round(audioBuffer.duration * 1000);
      
    updateVersionState(id, { isReady: true, durationMs });
    
    return audioBuffer;
  }, [getAudioContext, updateVersionState]);

  // ─── 병렬 재생 기동 엔진 ───
  const startParallelPlay = useCallback(async (targetOffset: number) => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // 1. 고유한 재생 태스크 ID 생성
    const taskId = ++playTaskIdRef.current;

    stopAllSources();

    if (!playingVersionId) return;
    
    const targetVersion = trackVersions.find(v => v.id === playingVersionId);
    if (!targetVersion) return;

    // 해당 트랙에 속한 모든 동위 버전 추출
    const siblingVersions = trackVersions.filter(v => v.track_id === targetVersion.track_id);
    const siblingIds = siblingVersions.map(v => v.id);

    // 재생을 준비하기 위해 트랙 내 모든 버전을 병렬로 디코딩 로드
    const buffersToPlay: { id: string; buffer: AudioBuffer }[] = [];
    let maxDuration = 0;

    for (const ver of siblingVersions) {
      try {
        const buf = await loadAudioBuffer(ver);
        // 비동기 대기 후 태스크가 폐기되었는지 체크
        if (taskId !== playTaskIdRef.current) return;

        buffersToPlay.push({ id: ver.id, buffer: buf });
        if (buf.duration > maxDuration) {
          maxDuration = buf.duration;
        }
      } catch (e) {
        console.error(`오디오 로딩 실패: ${ver.title}`, e);
      }
    }

    if (taskId !== playTaskIdRef.current) return;
    if (buffersToPlay.length === 0 || maxDuration === 0) return;

    const startTime = ctx.currentTime;
    startTimeRef.current = startTime;
    startOffsetRef.current = targetOffset;
    isPlayingRef.current = true;
    activeVersionIdsRef.current = siblingIds;

    // ── 모든 채널 동시 기동 및 볼륨 Gain 지정 ──
    buffersToPlay.forEach(({ id, buffer }) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true; // PCM 하드웨어 레벨 Gapless Loop 활성화

      const gainNode = ctx.createGain();
      const volume = id === playingVersionId ? 1.0 : 0.0;
      gainNode.gain.setValueAtTime(volume, startTime);

      source.connect(gainNode);
      // 마스터 볼륨 게인 노드에 커넥트
      gainNode.connect(getMasterGain());

      // 버퍼 루프 랩어라운드를 감안한 개별 시작 오프셋
      const offset = targetOffset % buffer.duration;
      source.start(startTime, offset);

      sourcesRef.current[id] = source;
      gainsRef.current[id] = gainNode;
    });

    startSync(maxDuration);
  }, [playingVersionId, trackVersions, getAudioContext, stopAllSources, loadAudioBuffer, startSync, getMasterGain]);

  // ─── playingVersionId 변경 처리 (0ms 크로스페이드 AB 스위칭) ───
  useEffect(() => {
    if (!playingVersionId) {
      stopAllSources();
      isPlayingRef.current = false;
      return;
    }

    const ctx = getAudioContext();
    const isAlreadyActive = activeVersionIdsRef.current.includes(playingVersionId);

    if (isAlreadyActive && isPlayingRef.current) {
      // ── 동일 트랙 내 AB 비교: 크로스페이드 볼륨 반전만 수행 (0ms 레이텐시) ──
      const time = ctx.currentTime;
      Object.keys(gainsRef.current).forEach(id => {
        const gainNode = gainsRef.current[id];
        const targetVol = id === playingVersionId ? 1.0 : 0.0;
        
        gainNode.gain.cancelScheduledValues(time);
        gainNode.gain.setValueAtTime(gainNode.gain.value, time);
        // 30ms 크로스페이드 램프로 틱 노이즈 100% 차단
        gainNode.gain.linearRampToValueAtTime(targetVol, time + 0.03);
      });
    } else {
      // ── 새로운 트랙 재생: 병렬 노드 구성 재로드 ──
      if (isPlaying) {
        startParallelPlay(0);
      } else {
        const targetVersion = trackVersions.find(v => v.id === playingVersionId);
        if (targetVersion) {
          loadAudioBuffer(targetVersion).catch(e => console.error(e));
        }
      }
    }
  }, [playingVersionId, trackVersions, isPlaying, getAudioContext, startParallelPlay, loadAudioBuffer, stopAllSources]);

  // ─── isPlaying 변경 처리 ───
  useEffect(() => {
    if (isPlaying) {
      if (!isPlayingRef.current && playingVersionId) {
        const store = useAudioStore.getState();
        startParallelPlay(store.globalCurrentTime);
      }
    } else {
      stopAllSources();
      isPlayingRef.current = false;
    }
  }, [isPlaying, playingVersionId, startParallelPlay, stopAllSources]);

  // ─── Seek 처리 ───
  useEffect(() => {
    if (seekRequestTime === null) return;
    if (isPlaying) {
      startParallelPlay(seekRequestTime);
    } else {
      setGlobalCurrentTime(seekRequestTime);
    }
    clearSeekRequest();
  }, [seekRequestTime, isPlaying, startParallelPlay, setGlobalCurrentTime, clearSeekRequest]);

  // ─── 볼륨 변경 처리 ───
  const volume = useAudioStore(state => state.volume);
  useEffect(() => {
    if (audioCtxRef.current && masterGainRef.current) {
      const time = audioCtxRef.current.currentTime;
      masterGainRef.current.gain.cancelScheduledValues(time);
      masterGainRef.current.gain.setValueAtTime(masterGainRef.current.gain.value, time);
      // 10ms 램프로 노이즈 100% 차단하면서 볼륨 조정
      masterGainRef.current.gain.linearRampToValueAtTime(volume, time + 0.01);
    }
  }, [volume]);

  return null;
}
