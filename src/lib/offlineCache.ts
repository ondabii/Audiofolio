import { ProjectData } from '@/store/projectStore';

// ─── LocalStorage 키 정의 ───
const OFFLINE_PROJECT_PREFIX = 'offline_project_data_';
const OFFLINE_PROJECTS_LIST_KEY = 'offline_projects_list';
const OFFLINE_CACHED_STATUS_PREFIX = 'offline_cached_status_';
const OFFLINE_CACHED_HASH_PREFIX = 'offline_cached_hash_';

/**
 * 1. 프로젝트 데이터를 로컬에 백업합니다.
 */
export function saveProjectToLocalStorage(project: ProjectData): void {
  if (typeof window === 'undefined' || !project) return;
  try {
    // 1-1. ID를 키로 저장
    localStorage.setItem(`${OFFLINE_PROJECT_PREFIX}${project.id}`, JSON.stringify(project));
    // 1-2. Alias를 키로 저장 (복원 lookup을 더 쉽게 하기 위함)
    if (project.custom_alias) {
      localStorage.setItem(`${OFFLINE_PROJECT_PREFIX}${project.custom_alias}`, JSON.stringify(project));
    }
  } catch (e) {
    console.error('Failed to save project data to localStorage:', e);
  }
}

/**
 * 2. 로컬 스토리지에서 프로젝트 백업 데이터를 가져옵니다.
 */
export function getProjectFromLocalStorage(aliasOrId: string): ProjectData | null {
  if (typeof window === 'undefined' || !aliasOrId) return null;
  try {
    const raw = localStorage.getItem(`${OFFLINE_PROJECT_PREFIX}${aliasOrId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('Failed to read project data from localStorage:', e);
    return null;
  }
}

/**
 * 3. 전체 프로젝트 대시보드 리스트 데이터를 로컬에 백업합니다.
 */
export function saveProjectsListToLocalStorage(projects: any[]): void {
  if (typeof window === 'undefined' || !projects) return;
  try {
    localStorage.setItem(OFFLINE_PROJECTS_LIST_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('Failed to save projects list to localStorage:', e);
  }
}

export const DEFAULT_SEED_PROJECTS = [
  {
    id: 'bias',
    title: 'BIAS',
    short_id: 'bias',
    custom_alias: 'bias',
    is_protected: false,
    created_at: new Date().toISOString()
  }
];

/**
 * 4. 로컬 스토리지에서 전체 프로젝트 대시보드 목록을 복원합니다.
 */
export function getProjectsListFromLocalStorage(): any[] {
  if (typeof window === 'undefined') return DEFAULT_SEED_PROJECTS;
  try {
    const raw = localStorage.getItem(OFFLINE_PROJECTS_LIST_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return (parsed && parsed.length > 0) ? parsed : DEFAULT_SEED_PROJECTS;
  } catch (e) {
    console.error('Failed to read projects list from localStorage:', e);
    return DEFAULT_SEED_PROJECTS;
  }
}

/**
 * 5. 프로젝트의 구조적 변경사항을 비교하기 위한 시그니처 해시 문자열을 생성합니다.
 */
export function generateProjectHash(project: ProjectData | null): string {
  if (!project) return '';
  const parts: string[] = [project.id, project.title, project.custom_alias];
  
  if (project.categories) {
    project.categories.forEach((cat) => {
      parts.push(`cat:${cat.id}:${cat.title}`);
      if (cat.tracks) {
        cat.tracks.forEach((track) => {
          parts.push(`track:${track.id}:${track.title}:${track.is_downloadable}`);
          if (track.versions) {
            track.versions.forEach((ver) => {
              parts.push(`ver:${ver.id}:${ver.audio_url}:${ver.is_normalized}:${ver.is_representative}:${ver.is_visible}`);
            });
          }
        });
      }
    });
  }
  return parts.join('|');
}

/**
 * 6. 프로젝트 하위의 모든 버전 오디오 파일을 Cache API에 미리 프리로드(오프라인 저장)합니다.
 */
export async function cacheProjectAudioFiles(
  project: ProjectData,
  onProgress: (percent: number) => void
): Promise<void> {
  if (typeof window === 'undefined') return;
  const cacheName = 'audiofolio-audio-v1';
  const urlsToCache: string[] = [];

  if (project.categories) {
    project.categories.forEach((cat) => {
      if (cat.tracks) {
        cat.tracks.forEach((track) => {
          if (track.versions) {
            track.versions.forEach((ver) => {
              if (ver.audio_url) {
                const apiFetchUrl = `/api/audio-url?key=${encodeURIComponent(ver.audio_url)}`;
                urlsToCache.push(apiFetchUrl);
              }
            });
          }
        });
      }
    });
  }

  if (urlsToCache.length === 0) {
    onProgress(100);
    return;
  }

  let completed = 0;
  const cache = await caches.open(cacheName);

  for (const url of urlsToCache) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
      } else {
        console.warn(`Fetch returned status ${response.status} for ${url}`);
      }
    } catch (e) {
      console.error(`Failed to cache raw audio: ${url}`, e);
    }
    completed++;
    onProgress(Math.round((completed / urlsToCache.length) * 100));
  }
}

/**
 * 7. 프로젝트가 오프라인 저장되어 있는지 여부를 판별합니다.
 */
export function isProjectOfflineCached(projectId: string): boolean {
  if (typeof window === 'undefined' || !projectId) return false;
  return localStorage.getItem(`${OFFLINE_CACHED_STATUS_PREFIX}${projectId}`) === 'true';
}

/**
 * 8. 오프라인 캐시가 완료되었을 당시 기록해 둔 프로젝트의 해시 시그니처를 반환합니다.
 */
export function getOfflineCachedHash(projectId: string): string {
  if (typeof window === 'undefined' || !projectId) return '';
  return localStorage.getItem(`${OFFLINE_CACHED_HASH_PREFIX}${projectId}`) || '';
}

/**
 * 9. 캐싱 완료 시점의 프로젝트 해시 시그니처와 캐시 완료 상태를 저장합니다.
 */
export function setOfflineCachedHash(projectId: string, hash: string, isCached: boolean = true): void {
  if (typeof window === 'undefined' || !projectId) return;
  try {
    if (isCached) {
      localStorage.setItem(`${OFFLINE_CACHED_STATUS_PREFIX}${projectId}`, 'true');
      localStorage.setItem(`${OFFLINE_CACHED_HASH_PREFIX}${projectId}`, hash);
    } else {
      localStorage.removeItem(`${OFFLINE_CACHED_STATUS_PREFIX}${projectId}`);
      localStorage.removeItem(`${OFFLINE_CACHED_HASH_PREFIX}${projectId}`);
    }
  } catch (e) {
    console.error('Failed to set offline cache metadata:', e);
  }
}
