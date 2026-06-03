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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const loadedVersionIdRef = useRef<string | null>(null);

  // ─── 시간 동기화 루프 ───
  const stopSync = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  const startSync = useCallback(() => {
    stopSync();
    const tick = () => {
      const audio = audioRef.current;
      if (audio) setGlobalCurrentTime(audio.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopSync, setGlobalCurrentTime]);

  // ─── 언마운트 정리 ───
  useEffect(() => {
    return () => {
      stopSync();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, [stopSync]);

  // ─── playingVersionId 변경 시 오디오 소스 교체 ───
  useEffect(() => {
    if (!playingVersionId) return;

    const version = trackVersions.find((v: any) => v.id === playingVersionId);
    if (!version?.audio_url) return;

    // 이미 같은 버전이면 스킵
    if (loadedVersionIdRef.current === playingVersionId) return;
    loadedVersionIdRef.current = playingVersionId;

    // <audio> 엘리먼트 생성 또는 재사용
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    audio.loop = true;
    audio.preload = 'auto';

    // 이전 소스 정리
    stopSync();
    audio.pause();

    const audioUrl = `/api/audio-url?key=${encodeURIComponent(version.audio_url)}`;
    updateVersionState(playingVersionId, { isReady: false });

    audio.src = audioUrl;
    audio.load();

    // 재생 가능 상태가 되면
    const onCanPlay = () => {
      // DB duration_ms 우선 사용, 없으면 audio.duration
      const durationMs = version.duration_ms > 0
        ? version.duration_ms
        : Math.round(audio.duration * 1000);

      updateVersionState(playingVersionId, { isReady: true, durationMs });

      const store = useAudioStore.getState();
      if (store.isPlaying && store.playingVersionId === playingVersionId) {
        audio.play()
          .then(() => startSync())
          .catch(err => console.error('[AudioEngine] 재생 실패:', err));
      }
    };

    const onError = () => {
      console.error('[AudioEngine] 오디오 로드 오류:', audio.src);
      updateVersionState(playingVersionId, { isReady: false });
    };

    // 기존 리스너 제거 후 새로 등록
    audio.removeEventListener('canplay', onCanPlay);
    audio.removeEventListener('error', onError);
    audio.addEventListener('canplay', onCanPlay, { once: true });
    audio.addEventListener('error', onError, { once: true });

  }, [playingVersionId, trackVersions, updateVersionState, startSync, stopSync]);

  // ─── isPlaying 변경 처리 ───
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playingVersionId) return;

    if (isPlaying) {
      if (audio.readyState >= 2) {
        // 버퍼 준비됨 → 즉시 재생
        audio.play()
          .then(() => startSync())
          .catch(err => console.error('[AudioEngine] 재생 실패:', err));
      }
      // readyState < 2 이면 canplay 이벤트에서 재생 처리
    } else {
      audio.pause();
      stopSync();
    }
  }, [isPlaying, playingVersionId, startSync, stopSync]);

  // ─── Seek 처리 ───
  useEffect(() => {
    if (seekRequestTime === null) return;
    const audio = audioRef.current;
    if (audio && audio.readyState >= 1) {
      audio.currentTime = seekRequestTime;
    }
    clearSeekRequest();
  }, [seekRequestTime, clearSeekRequest]);

  return null;
}
