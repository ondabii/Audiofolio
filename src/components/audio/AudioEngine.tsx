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

  // ─── 오디오 객체 생성 및 상시 리스너 바인딩 ───
  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    audioRef.current = audio;

    const onCanPlay = () => {
      const currentId = useAudioStore.getState().playingVersionId;
      if (!currentId) return;

      const version = trackVersions.find((v: any) => v.id === currentId);
      const durationMs = (version?.duration_ms > 0)
        ? version.duration_ms
        : Math.round(audio.duration * 1000);

      updateVersionState(currentId, { isReady: true, durationMs });

      // 현재 재생 중이면 재생 처리
      const store = useAudioStore.getState();
      if (store.isPlaying && store.playingVersionId === currentId) {
        audio.play()
          .then(() => startSync())
          .catch(err => console.error('[AudioEngine] onCanPlay 재생 실패:', err));
      }
    };

    const onError = () => {
      const currentId = useAudioStore.getState().playingVersionId;
      if (currentId) {
        console.error('[AudioEngine] 오디오 로드 오류:', audio.src);
        updateVersionState(currentId, { isReady: false });
      }
    };

    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('error', onError);

    return () => {
      stopSync();
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [trackVersions, updateVersionState, startSync, stopSync]);

  // ─── playingVersionId 변경 시 오디오 소스 교체 ───
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!playingVersionId) {
      audio.pause();
      audio.src = '';
      loadedVersionIdRef.current = null;
      stopSync();
      return;
    }

    // 이미 같은 버전이 로드되어 있으면 스킵
    if (loadedVersionIdRef.current === playingVersionId) {
      return;
    }
    loadedVersionIdRef.current = playingVersionId;

    const version = trackVersions.find((v: any) => v.id === playingVersionId);
    if (!version?.audio_url) return;

    stopSync();
    audio.pause();

    updateVersionState(playingVersionId, { isReady: false });
    audio.src = `/api/audio-url?key=${encodeURIComponent(version.audio_url)}`;
    audio.load();
  }, [playingVersionId, trackVersions, updateVersionState, stopSync]);

  // ─── isPlaying 변경 처리 ───
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playingVersionId) return;

    if (isPlaying) {
      // readyState가 2(HAVE_CURRENT_DATA) 이상이면 즉시 재생 가능
      if (audio.readyState >= 2) {
        audio.play()
          .then(() => startSync())
          .catch(err => console.error('[AudioEngine] isPlaying 재생 실패:', err));
      } else {
        // readyState가 부족하면 로딩 상태로 두고 load() 트리거하여 canplay 리스너 유도
        updateVersionState(playingVersionId, { isReady: false });
        audio.load();
      }
    } else {
      audio.pause();
      stopSync();
    }
  }, [isPlaying, playingVersionId, startSync, stopSync, updateVersionState]);

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
