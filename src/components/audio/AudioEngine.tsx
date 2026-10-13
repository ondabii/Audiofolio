'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAudioStore } from '@/store/audioStore';
import { useProjectStore } from '@/store/projectStore';
import { getAudioContext as getGlobalAudioContext } from '@/lib/audioContext';

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
    setLoadingProgress,
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
      audioCtxRef.current = getGlobalAudioContext();
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

  const startSync = useCallback((maxDuration: number, isPlaylistMode: boolean = false) => {
    stopSync();
    const tick = () => {
      const ctx = audioCtxRef.current;
      if (ctx && isPlayingRef.current && maxDuration > 0) {
        const elapsed = ctx.currentTime - startTimeRef.current;
        const currentRaw = elapsed + startOffsetRef.current;
        const current = isPlaylistMode
          ? Math.min(currentRaw, maxDuration)
          : (currentRaw % maxDuration);
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

  // 언마운트 정리 (오디오 소스 노드만 클린업하고 싱글톤 AudioContext는 유지)
  useEffect(() => {
    return () => {
      stopAllSources();
      audioCtxRef.current = null;
    };
  }, [stopAllSources]);

  // ─── 오디오 바이너리 fetch 및 AudioBuffer 디코딩 캐시 ───
  const loadAudioBuffer = useCallback(async (
    version: TrackVersion,
    reportProgress: boolean = false
  ): Promise<{ buffer: AudioBuffer; loopStart: number; loopEnd: number; maxPeak: number }> => {
    const id = version.id;
    if (buffersRef.current[id]) {
      return buffersRef.current[id];
    }

    updateVersionState(id, { isReady: false });

    let connectingInterval: ReturnType<typeof setInterval> | null = null;
    let connectingTimeout: ReturnType<typeof setTimeout> | null = null;
    const abortCtrl = new AbortController();

    if (reportProgress) {
      let connectingPct = 0;
      setLoadingProgress(id, {
        stage: 'connecting',
        percent: 0,
        message: '서버 연결 중...'
      });

      // 💡 0% -> 15% -> 0% 순환 애니메이션 (100ms마다 1%씩 증가, 15% 도달 시 0%로 리셋 후 재상승)
      connectingInterval = setInterval(() => {
        connectingPct = (connectingPct + 1) % 16;
        setLoadingProgress(id, {
          stage: 'connecting',
          percent: connectingPct,
          message: '서버 연결 중...'
        });
      }, 100);

      // 💡 10초 네트워크 연결 타임아웃
      connectingTimeout = setTimeout(() => {
        abortCtrl.abort();
      }, 10000);
    }

    const url = `/api/audio-url?key=${encodeURIComponent(version.audio_url)}`;
    
    // 💡 Cache API 가로채기 (오프라인 재생 지원)
    let res: Response;
    let isFromCache = false;
    try {
      const cache = await caches.open('audiofolio-audio-v1');
      const cachedRes = await cache.match(url);
      if (cachedRes) {
        res = cachedRes;
        isFromCache = true;
      } else {
        res = await fetch(url, { signal: abortCtrl.signal });
      }
    } catch (e: unknown) {
      if (reportProgress) {
        if (connectingInterval) clearInterval(connectingInterval);
        if (connectingTimeout) clearTimeout(connectingTimeout);

        setLoadingProgress(id, {
          stage: 'error',
          percent: 0,
          message: '인터넷 연결을 확인해주세요',
          isError: true
        });
        setTimeout(() => {
          setLoadingProgress(id, null);
        }, 3500);
        useAudioStore.getState().setIsPlaying(false);
      }
      throw e;
    } finally {
      if (connectingInterval) clearInterval(connectingInterval);
      if (connectingTimeout) clearTimeout(connectingTimeout);
    }
    
    if (!res.ok) {
      if (reportProgress) {
        setLoadingProgress(id, {
          stage: 'error',
          percent: 0,
          message: '인터넷 연결을 확인해주세요',
          isError: true
        });
        setTimeout(() => {
          setLoadingProgress(id, null);
        }, 3500);
        useAudioStore.getState().setIsPlaying(false);
      }
      throw new Error(`HTTP error: ${res.status}`);
    }

    let arrayBuffer: ArrayBuffer;

    if (isFromCache || !reportProgress || !res.body) {
      if (reportProgress) {
        setLoadingProgress(id, {
          stage: 'downloading',
          percent: 75,
          message: '캐시 음원 로드 중...'
        });
      }
      arrayBuffer = await res.arrayBuffer();
    } else {
      // 💡 ReadableStream을 통한 실시간 바이트 수신율 연산 (15% ~ 80% 구간 매핑)
      const contentLengthHeader = res.headers.get('content-length');
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
      
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;
      let lastReportTime = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedBytes += value.length;

          const now = Date.now();
          if (now - lastReportTime > 40) {
            lastReportTime = now;
            let currentPct = 40;
            if (totalBytes > 0) {
              currentPct = Math.min(80, 15 + Math.round((receivedBytes / totalBytes) * 65));
            } else {
              // totalBytes가 없는 경우 점진적 증가
              currentPct = Math.min(78, 15 + Math.round((receivedBytes / (1024 * 1024 * 5)) * 63));
            }
            setLoadingProgress(id, {
              stage: 'downloading',
              percent: currentPct,
              message: '음원 수신 중...'
            });
          }
        }
      }

      const merged = new Uint8Array(receivedBytes);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      arrayBuffer = merged.buffer;
    }

    const ctx = getAudioContext();
    
    if (reportProgress) {
      setLoadingProgress(id, {
        stage: 'decoding',
        percent: 85,
        message: '오디오 디코딩 중...'
      });
    }

    // 💡 Safari/Firefox/모바일 크로스 브라우저 호환 디코딩 래퍼 (ArrayBuffer neuter 방지 및 Callback/Promise 하이브리드 지원)
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        const bufferCopy = arrayBuffer.slice(0);
        try {
          const promise = ctx.decodeAudioData(
            bufferCopy,
            (decoded) => resolve(decoded),
            (err) => reject(err)
          );
          if (promise && typeof promise.then === 'function') {
            promise.then(resolve).catch(reject);
          }
        } catch (err) {
          reject(err);
        }
      });
    } catch (decodeErr) {
      if (reportProgress) setLoadingProgress(id, null);
      throw decodeErr;
    }
    
    if (reportProgress) {
      setLoadingProgress(id, {
        stage: 'decoding',
        percent: 95,
        message: '오디오 최적화 중...'
      });
    }

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

    if (reportProgress) {
      setLoadingProgress(id, {
        stage: 'ready',
        percent: 100,
        message: '재생 준비 완료'
      });
      setTimeout(() => {
        setLoadingProgress(id, null);
      }, 150);
    }
    
    return cached;
  }, [getAudioContext, updateVersionState, setLoadingProgress]);

  // ─── 활성 음원 동적 재생 기동 엔진 (Active-Only Voice Control) ───
  const startSinglePlay = useCallback(async (targetVersionId: string, targetOffset: number) => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended' || (ctx as any).state === 'interrupted') {
      try {
        await ctx.resume();
      } catch (e) {}
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

    // 1. 재생하기로 선택한 버전(targetVersion)의 버퍼 캐시 로드 (진척도 리포트 활성화)
    let cachedTarget;
    try {
      cachedTarget = await loadAudioBuffer(targetVersion, true);
      if (taskId !== playTaskIdRef.current) return;
    } catch (e) {
      console.error(`재생 대상 오디오 로딩 실패: ${targetVersion.title}`, e);
      return;
    }

    // 해당 트랙의 재생 모드 판별 (연속 재생 vs AB 비교)
    const project = useProjectStore.getState().project;
    const currentTrack = project?.categories
      ?.flatMap((c: any) => c.tracks || [])
      ?.find((t: any) => t.id === targetVersion.track_id);
    const isPlaylistMode = currentTrack?.playback_mode === 'playlist';

    const { buffer: targetBuf, loopStart: targetLoopStart, loopEnd: targetLoopEnd } = cachedTarget;
    
    // 💡 플레이리스트 모드일 때는 트림 없이 원본 전체 길이(0 ~ duration)를 그대로 사용
    const effectiveLoopStart = isPlaylistMode ? 0 : targetLoopStart;
    const effectiveLoopEnd = isPlaylistMode ? targetBuf.duration : targetLoopEnd;
    const targetDuration = effectiveLoopEnd - effectiveLoopStart;

    // 미리 전체 최대 길이 산출 (AB 모드일 때만 최대 길이 기준, 플레이리스트 모드는 해당 곡 길이 기준)
    let maxDuration = siblingVersions.reduce((max, v) => {
      const vDur = v.duration_ms > 0 ? v.duration_ms / 1000 : 0;
      return Math.max(max, vDur);
    }, 0);
    if (maxDuration === 0 || isPlaylistMode) {
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
    
    // 💡 플레이리스트 모드: 루프 X, AB 비교 모드: 루프 O
    targetSource.loop = !isPlaylistMode;
    targetSource.loopStart = effectiveLoopStart;
    targetSource.loopEnd = effectiveLoopEnd;

    // 💡 플레이리스트 연속 재생: 한 곡 완주 시 다음 버전으로 바톤 터치 (00:00부터 시작)
    if (isPlaylistMode) {
      targetSource.onended = () => {
        if (taskId === playTaskIdRef.current && isPlayingRef.current) {
          const currentIndex = siblingVersions.findIndex(v => v.id === targetVersionId);
          if (currentIndex >= 0 && currentIndex < siblingVersions.length - 1) {
            const nextVersion = siblingVersions[currentIndex + 1];
            setGlobalCurrentTime(0);
            setRawCurrentTime(0);
            useAudioStore.getState().setPlayingVersionId(nextVersion.id);
            startSinglePlay(nextVersion.id, 0);
          } else {
            // 마지막 곡까지 모두 완주된 경우 재생 종료
            useAudioStore.getState().setIsPlaying(false);
            isPlayingRef.current = false;
          }
        }
      };
    }

    const targetGain = ctx.createGain();
    
    // 볼륨 페이드인 기동 (노멀라이즈 적용 여부 확인 및 게인 보정값 연산)
    const isNormalized = useAudioStore.getState().normalizedVersionIds[targetVersionId] || false;
    const targetPeakVolume = isNormalized ? (1.0 / cachedTarget.maxPeak) : 1.0;

    targetGain.gain.setValueAtTime(0.0, now);
    targetGain.gain.linearRampToValueAtTime(targetPeakVolume, now + fadeDuration);

    targetSource.connect(targetGain);
    targetGain.connect(getMasterGain());

    // 재생 위상 보정 계산
    const targetOffsetCalculated = isPlaylistMode 
      ? Math.max(0, targetOffset)
      : ((targetOffset % targetDuration) + targetLoopStart);
    targetSource.start(now, targetOffsetCalculated);

    // 레프 갱신
    sourcesRef.current = { [targetVersionId]: targetSource };
    gainsRef.current = { [targetVersionId]: targetGain };

    startTimeRef.current = now;
    startOffsetRef.current = targetOffset;
    isPlayingRef.current = true;
    activeVersionIdsRef.current = siblingIds;

    // 타임라인 동기화
    startSync(maxDuration, isPlaylistMode);

    // 4. 백그라운드 프리로드 (캐시 적재만 진행, 소스 재생은 하지 않음)
    // 💡 연속 재생 모드: 대역폭과 메모리 절약을 위해 모든 버전 순차로드 대신 '오직 다음 곡(N+1)' 1개만 프리로드
    // 💡 AB 비교 모드: 즉각적인 A/B 스위칭을 위해 인접 버전들을 순차 프리로드
    const preloadTargets = isPlaylistMode
      ? (targetIndex >= 0 && targetIndex < siblingVersions.length - 1 ? [siblingVersions[targetIndex + 1]] : [])
      : sortedSiblings.filter(v => v.id !== targetVersionId);

    (async () => {
      for (const ver of preloadTargets) {
        if (taskId !== playTaskIdRef.current) return;
        try {
          await loadAudioBuffer(ver);
        } catch (e) {
          console.error(`백그라운드 프리로드 실패: ${ver.title}`, e);
        }
      }
    })();
  }, [trackVersions, getAudioContext, stopAllSources, loadAudioBuffer, startSync, getMasterGain]);

  const currentTrackIdRef = useRef<string | null>(null);
  const currentVersionIdRef = useRef<string | null>(null);
  const pauseTimeRef = useRef<number>(0);
  const pauseTrackIdRef = useRef<string | null>(null);

  // ─── 통합 재생 / 일시정지 / 버전 전환 처리 (경합 조건 원천 차단) ───
  useEffect(() => {
    // 1. 일시정지 상태이거나 playingVersionId가 없는 경우
    if (!isPlaying || !playingVersionId) {
      if (isPlayingRef.current) {
        const store = useAudioStore.getState();
        const currentVersion = trackVersions.find(v => v.id === currentVersionIdRef.current);
        pauseTimeRef.current = store.rawCurrentTime;
        pauseTrackIdRef.current = currentVersion?.track_id || null;
        stopAllSources();
        isPlayingRef.current = false;
      }
      return;
    }

    // 2. 재생 요청 (isPlaying === true && playingVersionId 존재)
    const targetVersion = trackVersions.find(v => v.id === playingVersionId);
    if (!targetVersion) return;

    const targetTrackId = targetVersion.track_id;
    const isSameTrack = currentTrackIdRef.current !== null && currentTrackIdRef.current === targetTrackId;
    const isSameVersion = currentVersionIdRef.current === playingVersionId;

    if (!isSameTrack) {
      // 다른 트랙으로 변경 시 시간 리셋
      currentTrackIdRef.current = targetTrackId;
      currentVersionIdRef.current = playingVersionId;
      pauseTimeRef.current = 0;
      pauseTrackIdRef.current = null;
      setGlobalCurrentTime(0);
      setRawCurrentTime(0);
      stopAllSources();
      isPlayingRef.current = false;

      startSinglePlay(playingVersionId, 0).catch(e => console.error("재생 시작 실패:", e));
      return;
    }

    // 같은 트랙 내에서
    if (isPlayingRef.current && isSameVersion) {
      // 이미 이 버전이 재생 중인 상태라면 재시작 불필요
      return;
    }

    // 해당 트랙의 재생 모드 확인 (연속 재생 vs AB 비교)
    const project = useProjectStore.getState().project;
    const currentTrack = project?.categories
      ?.flatMap((c: any) => c.tracks || [])
      ?.find((t: any) => t.id === targetTrackId);
    const isPlaylistMode = currentTrack?.playback_mode === 'playlist';

    // 일시정지 상태에서 재개(Resume)하거나, 같은 트랙의 다른 버전으로 전환하는 경우
    const isSameTrackAsPaused = pauseTrackIdRef.current !== null && pauseTrackIdRef.current === targetTrackId;
    const store = useAudioStore.getState();

    // 💡 연속재생(isPlaylistMode) 모드에서 다음 버전으로 넘어가면 무조건 00:00(0초)부터 시작!
    let resumeTime = 0;
    if (isPlaylistMode) {
      if (isSameVersion && isSameTrackAsPaused && pauseTimeRef.current > 0) {
        resumeTime = pauseTimeRef.current;
      } else if (isSameVersion) {
        resumeTime = store.rawCurrentTime;
      } else {
        // 새 버전으로 넘어간 경우 무조건 0초부터 시작!
        resumeTime = 0;
        setGlobalCurrentTime(0);
        setRawCurrentTime(0);
      }
    } else {
      // AB 비교 모드: 같은 트랙 내 버전 간 스위칭 시 동일 재생 위치(rawCurrentTime) 유지
      resumeTime = isSameTrackAsPaused && pauseTimeRef.current > 0
        ? pauseTimeRef.current
        : store.rawCurrentTime;
    }

    pauseTimeRef.current = 0;
    pauseTrackIdRef.current = null;
    currentVersionIdRef.current = playingVersionId;

    startSinglePlay(playingVersionId, resumeTime).catch(e => console.error("재생 시작 실패:", e));
  }, [playingVersionId, isPlaying, trackVersions, startSinglePlay, stopAllSources, setGlobalCurrentTime, setRawCurrentTime]);

  // ─── Seek 처리 ───
  useEffect(() => {
    if (seekRequestTime === null) return;
    pauseTimeRef.current = 0;
    pauseTrackIdRef.current = null;
    if (isPlaying && playingVersionId) {
      startSinglePlay(playingVersionId, seekRequestTime).catch(e => console.error("Seek 실패:", e));
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
  const normalizedVersionIds = useAudioStore(state => state.normalizedVersionIds);
  useEffect(() => {
    if (!playingVersionId) return;

    const isNormalized = normalizedVersionIds[playingVersionId] || false;
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
  }, [normalizedVersionIds, playingVersionId]);

  return null;
}
