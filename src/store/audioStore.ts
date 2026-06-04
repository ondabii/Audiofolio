import { create } from 'zustand';

export interface VersionState {
  id: string;
  isReady: boolean;
  durationMs: number;
}

interface AudioStoreState {
  // 현재 메인으로 재생 중인 트랙 버전 ID
  playingVersionId: string | null;
  // 전체 기준 재생 시간 (초 단위)
  globalCurrentTime: number;
  // 루프 바운딩이 없는 생 재생 시간 (초 단위, 플레이헤드 싱크용)
  rawCurrentTime: number;
  // 재생 중 여부
  isPlaying: boolean;
  // 버퍼링 순차 대기열 (N-1, N+1 순)
  loadingQueue: string[];
  // 각 버전별 3초 버퍼 준비 상태 맵
  versionStates: Record<string, VersionState>;
  
  // 마스터 볼륨 (0.0 ~ 1.0)
  volume: number;
  
  // 사용자가 Progress 바 클릭 시 요청한 탐색(Seek) 시간 (초)
  seekRequestTime: number | null;
  
  // Actions
  setPlayingVersionId: (id: string | null) => void;
  setGlobalCurrentTime: (time: number) => void;
  setRawCurrentTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setLoadingQueue: (queue: string[]) => void;
  updateVersionState: (id: string, state: Partial<VersionState>) => void;
  setVolume: (volume: number) => void;
  requestSeek: (time: number) => void;
  clearSeekRequest: () => void;
  resetAudioState: () => void;
}

export const useAudioStore = create<AudioStoreState>((set) => ({
  playingVersionId: null,
  globalCurrentTime: 0,
  rawCurrentTime: 0,
  isPlaying: false,
  loadingQueue: [],
  versionStates: {},
  volume: 0.8,
  seekRequestTime: null,

  setPlayingVersionId: (id) => set({ playingVersionId: id }),
  setGlobalCurrentTime: (time) => set({ globalCurrentTime: time }),
  setRawCurrentTime: (time) => set({ rawCurrentTime: time }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setLoadingQueue: (queue) => set({ loadingQueue: queue }),
  updateVersionState: (id, state) => set((prev) => ({
    versionStates: {
      ...prev.versionStates,
      [id]: {
        ...(prev.versionStates[id] || { id, isReady: false, durationMs: 0 }),
        ...state,
      }
    }
  })),
  setVolume: (volume) => set({ volume }),
  requestSeek: (time) => set({ seekRequestTime: time }),
  clearSeekRequest: () => set({ seekRequestTime: null }),
  resetAudioState: () => set({
    playingVersionId: null,
    globalCurrentTime: 0,
    rawCurrentTime: 0,
    isPlaying: false,
    loadingQueue: [],
    versionStates: {},
    volume: 0.8,
    seekRequestTime: null
  })
}));
