import { create } from 'zustand';

export interface VersionData {
  id: string;
  track_id: string;
  title?: string;
  audio_url: string;
  public_url: string;
  is_representative: boolean;
  is_visible: boolean;
  duration_ms?: number;
  file_format?: string;
  bitrate?: number;
  file_size_bytes?: number;
  order_index: number;
}

export interface TrackData {
  id: string;
  category_id: string;
  title: string;
  order_index: number;
  versions: VersionData[];
}

export interface CategoryData {
  id: string;
  project_id: string;
  title: string;
  order_index: number;
  tracks: TrackData[];
}

export interface ProjectData {
  id: string;
  title: string;
  custom_alias: string;
  short_id?: string;
  is_protected?: boolean;
  pin_hash?: string;
  categories: CategoryData[];
}

interface ProjectStoreState {
  project: ProjectData | null;
  isLoading: boolean;
  
  // Actions
  setProject: (project: ProjectData) => void;
  updateCategoryTitle: (id: string, title: string) => void;
  updateTrackTitle: (id: string, title: string) => void;
  addCategory: (category: CategoryData) => void;
  addTrack: (track: TrackData) => void;
  deleteCategory: (id: string) => void;
  deleteTrack: (id: string) => void;
  reorderCategories: (oldIndex: number, newIndex: number) => void;
  reorderTracks: (categoryId: string, oldIndex: number, newIndex: number) => void;
  setRepresentativeVersion: (trackId: string, versionId: string) => void;
  toggleVersionVisibility: (trackId: string, versionId: string) => void;
}

export const useProjectStore = create<ProjectStoreState>((set) => ({
  project: null,
  isLoading: true,

  setProject: (project) => set({ project, isLoading: false }),
  
  updateCategoryTitle: (id, title) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        categories: state.project.categories.map(c => 
          c.id === id ? { ...c, title } : c
        )
      }
    };
  }),

  updateTrackTitle: (id, title) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        categories: state.project.categories.map(c => ({
          ...c,
          tracks: c.tracks.map(t => 
            t.id === id ? { ...t, title } : t
          )
        }))
      }
    };
  }),

  addCategory: (category) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        categories: [...state.project.categories, category]
      }
    };
  }),

  addTrack: (track) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        categories: state.project.categories.map(c => 
          c.id === track.category_id 
            ? { ...c, tracks: [...c.tracks, track] }
            : c
        )
      }
    };
  }),

  deleteCategory: (id) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        categories: state.project.categories.filter(c => c.id !== id)
      }
    };
  }),

  deleteTrack: (id) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        categories: state.project.categories.map(c => ({
          ...c,
          tracks: c.tracks.filter(t => t.id !== id)
        }))
      }
    };
  }),

  reorderCategories: (oldIndex, newIndex) => set((state) => {
    if (!state.project) return state;
    const newCats = [...state.project.categories];
    const [moved] = newCats.splice(oldIndex, 1);
    newCats.splice(newIndex, 0, moved);
    return { project: { ...state.project, categories: newCats } };
  }),

  reorderTracks: (categoryId, oldIndex, newIndex) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        categories: state.project.categories.map(c => {
          if (c.id !== categoryId) return c;
          const newTracks = [...c.tracks];
          const [moved] = newTracks.splice(oldIndex, 1);
          newTracks.splice(newIndex, 0, moved);
          return { ...c, tracks: newTracks };
        })
      }
    };
  }),

  setRepresentativeVersion: (trackId, versionId) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        categories: state.project.categories.map(c => ({
          ...c,
          tracks: c.tracks.map(t => 
            t.id === trackId 
              ? {
                  ...t,
                  versions: t.versions.map(v => ({
                    ...v,
                    is_representative: v.id === versionId
                  }))
                }
              : t
          )
        }))
      }
    };
  }),

  toggleVersionVisibility: (trackId, versionId) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        categories: state.project.categories.map(c => ({
          ...c,
          tracks: c.tracks.map(t => 
            t.id === trackId 
              ? {
                  ...t,
                  versions: t.versions.map(v => 
                    v.id === versionId ? { ...v, is_visible: !v.is_visible } : v
                  )
                }
              : t
          )
        }))
      }
    };
  })
}));
