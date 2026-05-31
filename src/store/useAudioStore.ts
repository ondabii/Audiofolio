import { create } from 'zustand';
import { audioEngine } from '@/lib/audioEngine';

export interface VersionInfo {
  id: string;
  url: string;
  duration: number;
}

interface AudioStore {
  isPlaying: boolean;
  activeTrackId: string | null;
  activeVersionId: string | null;
  globalCurrentTime: number; // 초 단위
  readyVersions: Set<string>; // 버퍼링이 3초 이상(또는 전체) 완료된 버전 ID들
  
  playTrack: (trackId: string, initialVersionId: string, versions: VersionInfo[]) => Promise<void>;
  resume: () => void;
  pause: () => void;
  seek: (time: number) => void;
  switchVersion: (versionId: string) => void;
  updateTime: () => void;
}

export const useAudioStore = create<AudioStore>((set, get) => ({
  isPlaying: false,
  activeTrackId: null,
  activeVersionId: null,
  globalCurrentTime: 0,
  readyVersions: new Set(),

  playTrack: async (trackId, initialVersionId, versions) => {
    // 오디오 컨텍스트 사용자 상호작용으로 초기화
    audioEngine.init();
    
    const targetVersion = versions.find(v => v.id === initialVersionId);
    if (!targetVersion) return;

    // 1. 현재 메인 버전 로드 (가장 먼저 수행)
    await audioEngine.loadBuffer(initialVersionId, targetVersion.url);
    
    set((state) => {
      const newReady = new Set(state.readyVersions);
      newReady.add(initialVersionId);
      return { readyVersions: newReady };
    });

    const state = get();
    audioEngine.play(initialVersionId, state.globalCurrentTime);
    set({ isPlaying: true, activeTrackId: trackId, activeVersionId: initialVersionId });

    // 2. 순차적 인접 버전 버퍼링 (N-1, N+1)
    const idx = versions.findIndex(v => v.id === initialVersionId);
    const toLoad = [];
    if (idx > 0) toLoad.push(versions[idx - 1]);
    if (idx < versions.length - 1) toLoad.push(versions[idx + 1]);

    for (const v of toLoad) {
      if (!get().readyVersions.has(v.id)) {
        // 비동기로 조용히 로드 진행
        audioEngine.loadBuffer(v.id, v.url).then(() => {
          set((s) => {
            const newReady = new Set(s.readyVersions);
            newReady.add(v.id);
            return { readyVersions: newReady };
          });
        }).catch(err => console.error("Buffer load failed for adj", v.id, err));
      }
    }
  },

  pause: () => {
    audioEngine.pause();
    set({ isPlaying: false, globalCurrentTime: audioEngine.getCurrentTime() });
  },

  resume: () => {
    const state = get();
    if (!state.isPlaying && state.activeVersionId) {
      audioEngine.play(state.activeVersionId, state.globalCurrentTime);
      set({ isPlaying: true });
    }
  },

  seek: (time: number) => {
    set({ globalCurrentTime: time });
    audioEngine.seek(time);
  },

  switchVersion: (versionId: string) => {
    const state = get();
    // 3초 버퍼 룰: readyVersions에 등록되지 않은 버전은 스위칭 방지 (UI단에서는 비활성화 처리됨)
    if (!state.readyVersions.has(versionId)) return; 
    
    const currentTime = state.isPlaying ? audioEngine.getCurrentTime() : state.globalCurrentTime;
    set({ activeVersionId: versionId, globalCurrentTime: currentTime });
    
    if (state.isPlaying) {
      // 즉시 크로스페이드(버전 스위칭) 실행
      audioEngine.play(versionId, currentTime);
    }
  },

  updateTime: () => {
    const state = get();
    if (state.isPlaying) {
      set({ globalCurrentTime: audioEngine.getCurrentTime() });
    }
  }
}));
