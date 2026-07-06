'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAudioStore } from '@/store/audioStore';

export interface TrackVersion {
  id: string;
  track_id: string;
  audio_url: string;
  title: string;
  is_representative: number;
  is_visible: number;
  duration_ms: number;
  file_format: string;
  bitrate: number;
  file_size_bytes: number;
  order_index: number;
  status: string;
  created_at: string;
  isReady?: boolean;
}

export function AudioEngine({ trackVersions = [] }: { trackVersions: TrackVersion[] }) {
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
  
  // AudioBuffer 외에도 시작/끝 무음 트리밍 지점 및 볼륨 피크 캐싱
  const buffersRef = useRef<Record<string, { buffer: AudioBuffer; loopStart: number; loopEnd: number; maxPeak: number }>>({});
  
  // 현재 동시 가동 중인 오디오 노드 레프
  const sourcesRef = useRef<Record<string, AudioBufferSourceNode>>({});
  const gainsRef = useRef<Record<string, GainNode>>({});
  
  // 페이드아웃 진행 중인 유령 노드들의 안전한 정지 관리를 위한 GC 레프
  const fadingNodesRef = useRef<{ id: string; source: AudioBufferSourceNode; gain: GainNode }[]>([]);
  
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
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) throw new Error("Web Audio API not supported");
      audioCtxRef.current = new AudioContextClass();
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

    // 1. 활성 소스 및 게인 즉각 정리
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

    // 2. 페이드아웃 진행 중이던 GC 대기열 노드들도 강제 즉각 정지 및 소멸
    fadingNodesRef.current.forEach(node => {
      try {
        node.source.stop();
        node.source.disconnect();
      } catch (e) {}
      try {
        node.gain.disconnect();
      } catch (e) {}
    });
    fadingNodesRef.current = [];

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
  const loadAudioBuffer = useCallback(async (version: TrackVersion): Promise<{ buffer: AudioBuffer; loopStart: number; loopEnd: number; maxPeak: number }> => {
    const id = version.id;
    if (buffersRef.current[id]) {
      return buffersRef.current[id];
    }

    updateVersionState(id, { isReady: false });
    const url = `/api/audio-url?key=${encodeURIComponent(version.audio_url)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);

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
    
    // 🔍 최대 피크 진폭 스캔 (노멀라이즈 볼륨 연산용)
    let maxPeak = 0.0001; // 0 나누기 방지
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      const channel = audioBuffer.getChannelData(c);
      for (let i = 0; i < channel.length; i++) {
        const val = Math.abs(channel[i]);
        if (val > maxPeak) maxPeak = val;
      }
    }
    
    const cached = {
      buffer: audioBuffer,
      loopStart,
      loopEnd,
      maxPeak
    };
    
    buffersRef.current[id] = cached;
    
    // 실제 소리가 시작되고 끝나는 유효 재생 시간을 기준치로 산출
    const durationMs = Math.round((loopEnd - loopStart) * 1000);
    updateVersionState(id, { isReady: true, durationMs });
    
    return cached;
  }, [getAudioContext, updateVersionState]);

  // ─── 활성 음원 동적 재생 기동 엔진 (Active-Only Voice Control) ───
  const startSinglePlay = useCallback(async (targetVersionId: string, targetOffset: number) => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (!targetVersionId) return;
    
    const targetVersion = trackVersions.find(v => v.id === targetVersionId);
    if (!targetVersion) return;

    // 해당 트랙에 속한 모든 동위 버전 추출
    const siblingVersions = trackVersions.filter(v => v.track_id === targetVersion.track_id);
    const siblingIds = siblingVersions.map(v => v.id);

    // 버전 순서 정렬: targetVersion이 0순위, N-1, N+1, N-2, N+2... 순 (백그라운드 프리로드용)
    const targetIndex = siblingVersions.findIndex(v => v.id === targetVersionId);
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

    // 경합 조건 방지를 위한 고유 태스크 ID 생성
    const taskId = ++playTaskIdRef.current;

    // 1. 재생하기로 선택한 버전(targetVersion)의 버퍼 캐시 로드
    let cachedTarget;
    try {
      cachedTarget = await loadAudioBuffer(targetVersion);
      if (taskId !== playTaskIdRef.current) return;
    } catch (e) {
      console.error(`재생 대상 오디오 로딩 실패: ${targetVersion.title}`, e);
      return;
    }

    const { buffer: targetBuf, loopStart: targetLoopStart, loopEnd: targetLoopEnd } = cachedTarget;
    const targetDuration = targetLoopEnd - targetLoopStart;

    // 미리 전체 최대 길이 산출 (트리밍된 duration 기준)
    let maxDuration = siblingVersions.reduce((max, v) => {
      const vDur = v.duration_ms > 0 ? v.duration_ms / 1000 : 0;
      return Math.max(max, vDur);
    }, 0);
    if (maxDuration === 0) {
      maxDuration = targetDuration;
    }

    // 2. 0ms 크로스페이드를 위한 기존 활성 소스 페이드아웃 및 GC 대기열 이관 처리
    const now = ctx.currentTime;
    const fadeDuration = 0.015; // 15ms 페이드로 틱 노이즈 방지와 0ms 느낌 극대화

    Object.keys(sourcesRef.current).forEach(id => {
      const oldSource = sourcesRef.current[id];
      const oldGain = gainsRef.current[id];
      if (oldSource && oldGain) {
        if (id === targetVersionId) {
          // 동일 버전을 탐색(Seek)하거나 재시작하는 경우 딜레이 없이 즉각 정지 및 물리적 차단!
          try { oldSource.stop(); } catch (e) {}
          try { oldSource.disconnect(); } catch (e) {}
          try { oldGain.disconnect(); } catch (e) {}
        } else {
          // 다른 버전으로 스왑하는 경우는 15ms 부드러운 크로스페이드 처리
          oldGain.gain.cancelScheduledValues(now);
          oldGain.gain.setValueAtTime(oldGain.gain.value, now);
          oldGain.gain.linearRampToValueAtTime(0.0, now + fadeDuration);
          oldSource.stop(now + fadeDuration);
          
          // GC 대기열 이식
          const nodeToTrash = { id, source: oldSource, gain: oldGain };
          fadingNodesRef.current.push(nodeToTrash);

          // 페이드아웃 완료 직후 완벽한 소멸 정리 및 대기열 배출
          setTimeout(() => {
            try { oldSource.disconnect(); } catch (e) {}
            try { oldGain.disconnect(); } catch (e) {}
            fadingNodesRef.current = fadingNodesRef.current.filter(n => n.source !== oldSource);
          }, fadeDuration * 1000 + 50);
        }
      }
    });

    // sourcesRef 및 gainsRef 맵에서 즉각 클린업하여 다음 재생 등록 준비
    Object.keys(sourcesRef.current).forEach(id => {
      delete sourcesRef.current[id];
      delete gainsRef.current[id];
    });

    // 3. 신규 활성 음원 재생 기동 (오직 1개의 음원만 믹싱 스레드에서 돌아가도록 고안됨)
    const targetSource = ctx.createBufferSource();
    targetSource.buffer = targetBuf;
    targetSource.loop = true;
    targetSource.loopStart = targetLoopStart;
    targetSource.loopEnd = targetLoopEnd;

    const targetGain = ctx.createGain();
    
    // 볼륨 페이드인 기동 (노멀라이즈 적용 여부 확인 및 게인 보정값 연산)
    const isNormalized = useAudioStore.getState().normalizedTrackIds[targetVersion.track_id] || false;
    const targetPeakVolume = isNormalized ? (1.0 / cachedTarget.maxPeak) : 1.0;

    targetGain.gain.setValueAtTime(0.0, now);
    targetGain.gain.linearRampToValueAtTime(targetPeakVolume, now + fadeDuration);

    targetSource.connect(targetGain);
    targetGain.connect(getMasterGain());

    // 재생 위상 보정 계산
    const targetOffsetCalculated = (targetOffset % targetDuration) + targetLoopStart;
    targetSource.start(now, targetOffsetCalculated);

    // 레프 갱신
    sourcesRef.current = { [targetVersionId]: targetSource };
    gainsRef.current = { [targetVersionId]: targetGain };

    startTimeRef.current = now;
    startOffsetRef.current = targetOffset;
    isPlayingRef.current = true;
    activeVersionIdsRef.current = siblingIds;

    // 타임라인 동기화
    startSync(maxDuration);

    // 4. 나머지 형제 버전들은 백그라운드 프리로드만 수행하고, 소스는 재생하지 않음! (부하 0%)
    const remainingVersions = sortedSiblings.filter(v => v.id !== targetVersionId);

    (async () => {
      for (const ver of remainingVersions) {
        if (taskId !== playTaskIdRef.current) return;
        try {
          // 캐시 적재만 진행 (CreateBufferSource 재생은 호출 안 함)
          await loadAudioBuffer(ver);
        } catch (e) {
          console.error(`백그라운드 프리로드 실패: ${ver.title}`, e);
        }
      }
    })();
  }, [trackVersions, getAudioContext, stopAllSources, loadAudioBuffer, startSync, getMasterGain]);

  // ─── playingVersionId 변경 처리 (0ms 크로스페이드 AB 스위칭) ───
  useEffect(() => {
    if (!playingVersionId) {
      stopAllSources();
      isPlayingRef.current = false;
      return;
    }

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
      startSinglePlay(playingVersionId, targetTime);
    } else {
      if (targetVersion) {
        loadAudioBuffer(targetVersion).catch(e => console.error(e));
      }
    }
  }, [playingVersionId, trackVersions, isPlaying, startSinglePlay, loadAudioBuffer, stopAllSources, setGlobalCurrentTime, setRawCurrentTime]);

  // ─── isPlaying 변경 처리 ───
  useEffect(() => {
    if (isPlaying) {
      if (!isPlayingRef.current && playingVersionId) {
        const store = useAudioStore.getState();
        startSinglePlay(playingVersionId, store.rawCurrentTime);
      }
    } else {
      stopAllSources();
      isPlayingRef.current = false;
    }
  }, [isPlaying, playingVersionId, startSinglePlay, stopAllSources]);

  // ─── Seek 처리 ───
  useEffect(() => {
    if (seekRequestTime === null) return;
    if (isPlaying) {
      startSinglePlay(playingVersionId, seekRequestTime);
    } else {
      setGlobalCurrentTime(seekRequestTime);
      setRawCurrentTime(seekRequestTime);
    }
    clearSeekRequest();
  }, [seekRequestTime, isPlaying, playingVersionId, startSinglePlay, setGlobalCurrentTime, setRawCurrentTime, clearSeekRequest]);

  // ─── 볼륨 변경 처리 ───
  const volume = useAudioStore(state => state.volume);
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = volume;
    }
  }, [volume]);

  // ─── 실시간 노멀라이즈 토글 감지 및 램프 반영 ───
  const normalizedTrackIds = useAudioStore(state => state.normalizedTrackIds);
  useEffect(() => {
    if (!playingVersionId) return;
    const targetVersion = trackVersions.find(v => v.id === playingVersionId);
    if (!targetVersion) return;

    const isNormalized = normalizedTrackIds[targetVersion.track_id] || false;
    const cached = buffersRef.current[playingVersionId];
    if (!cached) return;

    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const gainNode = gainsRef.current[playingVersionId];
    if (gainNode) {
      const now = ctx.currentTime;
      const targetVol = isNormalized ? (1.0 / cached.maxPeak) : 1.0;
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      // 15ms 미세 볼륨 램프로 실시간 부드러운 스케일링 보정
      gainNode.gain.linearRampToValueAtTime(targetVol, now + 0.015);
    }
  }, [normalizedTrackIds, playingVersionId, trackVersions]);

  return null;
}
