'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAudioStore } from '@/store/audioStore';

export function AudioEngine({ trackVersions = [] }: { trackVersions: any[] }) {
  const {
    playingVersionId,
    isPlaying,
    seekRequestTime,
    setGlobalCurrentTime,
    setRawCurrentTime,
    updateVersionState,
    clearSeekRequest,
  } = useAudioStore();

  const audioCtxRef = useRef<AudioContext | null>(null);
  
  // AudioBuffer 외에도 시작/끝 무음 트리밍 지점 캐싱
  const buffersRef = useRef<Record<string, { buffer: AudioBuffer; loopStart: number; loopEnd: number }>>({});
  
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
        const currentRaw = elapsed + startOffsetRef.current;
        const current = currentRaw % maxDuration;
        setGlobalCurrentTime(current);
        setRawCurrentTime(currentRaw);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopSync, setGlobalCurrentTime, setRawCurrentTime]);

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
  const loadAudioBuffer = useCallback(async (version: any): Promise<{ buffer: AudioBuffer; loopStart: number; loopEnd: number }> => {
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
    
    // 🔍 Intelligent Silence Trimmer (Vorbis/MP3 디코더 패딩 제거용 40ms 윈도우 가드 탑재)
    const channelData = audioBuffer.getChannelData(0); // 1번 채널 기준으로 무음구간 분석
    const len = channelData.length;
    const sampleRate = audioBuffer.sampleRate;
    
    // 임계치 설정 (-66dB 수준의 노이즈 컷오프 0.0005)
    const threshold = 0.0005;
    
    // 1. 시작 무음부 (Vorbis/MP3 디코더 지연) 감지 - 극초반 40ms 이내에서만 분석
    let startIndex = 0;
    const startScanLimit = Math.min(len, Math.floor(sampleRate * 0.04));
    for (let i = 0; i < startScanLimit; i++) {
      if (Math.abs(channelData[i]) > threshold) {
        startIndex = i;
        break;
      }
    }
    
    // 2. 끝 무음부 (Vorbis/MP3 디코더 패딩) 감지 - 극후반 40ms 이내에서만 역방향 분석
    let endIndex = len - 1;
    const endScanLimit = Math.max(0, len - Math.floor(sampleRate * 0.04));
    for (let i = len - 1; i >= endScanLimit; i--) {
      if (Math.abs(channelData[i]) > threshold) {
        endIndex = i;
        break;
      }
    }
    
    // 안전 장치: 음원 알맹이가 90% 이상 온전히 보존된 경우에만 무음 절단
    const minSamples = Math.floor(len * 0.90);
    if (endIndex - startIndex < minSamples) {
      startIndex = 0;
      endIndex = len - 1;
    }
    
    const loopStart = startIndex / sampleRate;
    const loopEnd = (endIndex + 1) / sampleRate;
    
    const cached = {
      buffer: audioBuffer,
      loopStart,
      loopEnd
    };
    
    buffersRef.current[id] = cached;
    
    // 실제 소리가 시작되고 끝나는 유효 재생 시간을 기준치로 산출
    const durationMs = Math.round((loopEnd - loopStart) * 1000);
    updateVersionState(id, { isReady: true, durationMs });
    
    return cached;
  }, [getAudioContext, updateVersionState]);

  // ─── 병렬 재생 기동 엔진 ───
  const startParallelPlay = useCallback(async (targetOffset: number) => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    stopAllSources();

    // stopAllSources() 호출로 증가된 값을 무시하고, 최종 발급용 고유 태스크 ID 생성
    const taskId = ++playTaskIdRef.current;

    if (!playingVersionId) return;
    
    const targetVersion = trackVersions.find(v => v.id === playingVersionId);
    if (!targetVersion) return;

    // 해당 트랙에 속한 모든 동위 버전 추출
    const siblingVersions = trackVersions.filter(v => v.track_id === targetVersion.track_id);
    const siblingIds = siblingVersions.map(v => v.id);

    // 버전 순서 정렬: targetVersion이 0순위, N-1, N+1, N-2, N+2... 순
    const targetIndex = siblingVersions.findIndex(v => v.id === playingVersionId);
    const sortedSiblings = [...siblingVersions].sort((a, b) => {
      const idxA = siblingVersions.indexOf(a);
      const idxB = siblingVersions.indexOf(b);
      const distA = Math.abs(idxA - targetIndex);
      const distB = Math.abs(idxB - targetIndex);
      if (distA !== distB) {
        return distA - distB;
      }
      return idxA - idxB;
    });

    // 1. 재생하기로 선택한 버전(targetVersion)을 먼저 로드
    let cachedTarget: { buffer: AudioBuffer; loopStart: number; loopEnd: number };
    try {
      cachedTarget = await loadAudioBuffer(targetVersion);
      if (taskId !== playTaskIdRef.current) return;
    } catch (e) {
      console.error(`재생 대상 오디오 로딩 실패: ${targetVersion.title}`, e);
      return;
    }

    const { buffer: targetBuf, loopStart: targetLoopStart, loopEnd: targetLoopEnd } = cachedTarget;
    const targetDuration = targetLoopEnd - targetLoopStart;

    // 2. targetVersion 로드 성공 즉시 재생 기동
    const startTime = ctx.currentTime;
    startTimeRef.current = startTime;
    startOffsetRef.current = targetOffset;
    isPlayingRef.current = true;
    activeVersionIdsRef.current = siblingIds;

    // 미리 전체 최대 길이 산출 (트리밍된 duration 기준)
    let maxDuration = siblingVersions.reduce((max, v) => {
      const vDur = v.duration_ms > 0 ? v.duration_ms / 1000 : 0;
      return Math.max(max, vDur);
    }, 0);
    if (maxDuration === 0) {
      maxDuration = targetDuration;
    }

    const targetSource = ctx.createBufferSource();
    targetSource.buffer = targetBuf;
    targetSource.loop = true;
    targetSource.loopStart = targetLoopStart;
    targetSource.loopEnd = targetLoopEnd;

    const targetGain = ctx.createGain();
    targetGain.gain.setValueAtTime(1.0, startTime);

    targetSource.connect(targetGain);
    targetGain.connect(getMasterGain());

    // 0~duration 타임라인을 loopStart~loopEnd 윈도우 위상으로 맵핑 매칭
    const targetOffsetCalculated = (targetOffset % targetDuration) + targetLoopStart;
    targetSource.start(startTime, targetOffsetCalculated);

    sourcesRef.current[targetVersion.id] = targetSource;
    gainsRef.current[targetVersion.id] = targetGain;

    // 타임라인 동기화 즉시 기동
    startSync(maxDuration);

    // 3. 나머지 버전을 N-1, N+1 순차적으로 백그라운드 로드
    const remainingVersions = sortedSiblings.filter(v => v.id !== targetVersion.id);

    (async () => {
      let currentMaxDuration = maxDuration;
      for (const ver of remainingVersions) {
        if (taskId !== playTaskIdRef.current) return;
        try {
          const cachedBuf = await loadAudioBuffer(ver);
          if (taskId !== playTaskIdRef.current) return;

          const { buffer: buf, loopStart: bStart, loopEnd: bEnd } = cachedBuf;
          const bDuration = bEnd - bStart;

          // 만약 새로 로드된 버전이 이전의 maxDuration보다 길다면 maxDuration 확장 및 타이머 재기동
          if (bDuration > currentMaxDuration) {
            currentMaxDuration = bDuration;
            startSync(currentMaxDuration);
          }

          const now = ctx.currentTime;
          const elapsed = now - startTimeRef.current;
          const currentTimelineTime = (elapsed + startOffsetRef.current) % currentMaxDuration;
          
          // 위상 매핑 동기화 기동 오프셋 계산
          const offset = (currentTimelineTime % bDuration) + bStart;

          const source = ctx.createBufferSource();
          source.buffer = buf;
          source.loop = true;
          source.loopStart = bStart;
          source.loopEnd = bEnd;

          const gainNode = ctx.createGain();
          
          // 로드되는 시점에 타겟 버전으로 바뀌었을 수도 있으니 스토어 값 실시간 체크
          const isCurrent = useAudioStore.getState().playingVersionId === ver.id;
          const volume = isCurrent ? 1.0 : 0.0;
          gainNode.gain.setValueAtTime(volume, now);

          source.connect(gainNode);
          gainNode.connect(getMasterGain());

          source.start(now, offset);

          sourcesRef.current[ver.id] = source;
          gainsRef.current[ver.id] = gainNode;
        } catch (e) {
          console.error(`백그라운드 오디오 로딩 실패: ${ver.title}`, e);
        }
      }
    })();
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
      const targetVersion = trackVersions.find(v => v.id === playingVersionId);
      const prevActiveVersionId = Object.keys(sourcesRef.current)[0];
      const prevVersion = prevActiveVersionId ? trackVersions.find(v => v.id === prevActiveVersionId) : null;
      const isSameTrack = prevVersion && targetVersion && prevVersion.track_id === targetVersion.track_id;

      if (!isSameTrack) {
        // 완전히 다른 트랙으로 전환되는 것이므로 재생 경과 시간을 0초로 리셋!
        setGlobalCurrentTime(0);
        setRawCurrentTime(0);
      }

      if (isPlaying) {
        const targetTime = isSameTrack ? useAudioStore.getState().rawCurrentTime : 0;
        startParallelPlay(targetTime);
      } else {
        if (targetVersion) {
          loadAudioBuffer(targetVersion).catch(e => console.error(e));
        }
      }
    }
  }, [playingVersionId, trackVersions, isPlaying, getAudioContext, startParallelPlay, loadAudioBuffer, stopAllSources, setGlobalCurrentTime, setRawCurrentTime]);

  // ─── isPlaying 변경 처리 ───
  useEffect(() => {
    if (isPlaying) {
      if (!isPlayingRef.current && playingVersionId) {
        const store = useAudioStore.getState();
        startParallelPlay(store.rawCurrentTime);
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
      setRawCurrentTime(seekRequestTime);
    }
    clearSeekRequest();
  }, [seekRequestTime, isPlaying, startParallelPlay, setGlobalCurrentTime, setRawCurrentTime, clearSeekRequest]);

  // ─── 볼륨 변경 처리 ───
  const volume = useAudioStore(state => state.volume);
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = volume;
    }
  }, [volume]);

  return null;
}
