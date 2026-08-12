'use client';

import { useEffect, useRef } from 'react';
import { useProjectStore, ProjectData } from '@/store/projectStore';
import { saveProjectToLocalStorage, getProjectFromLocalStorage } from '@/lib/offlineCache';

interface ProjectHydratorProps {
  initialData?: ProjectData;
  project?: ProjectData;
  children?: React.ReactNode;
}

export function ProjectHydrator({ initialData, project, children }: ProjectHydratorProps) {
  const setProject = useProjectStore(state => state.setProject);
  const isHydrated = useRef(false);
  const data = (initialData || project) as any;

  useEffect(() => {
    async function hydrateData() {
      const alias = data?.custom_alias || data?.short_id || data?.id;

      // 1. 온라인 시 원격 Worker API에서 프로젝트 상세(카테고리/트랙/버전) 실시간 페칭
      if (alias) {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL 
            ? `${process.env.NEXT_PUBLIC_API_URL}/api/projects/${alias}?admin=true`
            : `/api/projects/${alias}?admin=true`;

          const res = await fetch(apiUrl);
          if (res.ok) {
            const remoteProject = await res.json();
            if (remoteProject && !remoteProject.error && remoteProject.title) {
              setProject(remoteProject);
              saveProjectToLocalStorage(remoteProject);
              isHydrated.current = true;
              return;
            }
          }
        } catch (e) {
          console.warn("Failed to fetch remote project details, trying local cache:", e);
        }
      }

      // 2. 원격 페칭 실패 시 (오프라인 상태) 로컬 스토리지 캐시에서 복원
      if (data && !data.is_offline_placeholder) {
        setProject(data);
        saveProjectToLocalStorage(data);
        isHydrated.current = true;
      } else if (alias) {
        const offlineData = getProjectFromLocalStorage(alias);
        if (offlineData) {
          setProject(offlineData);
          isHydrated.current = true;
        }
      }
    }

    hydrateData();
  }, [data, setProject]);

  return <>{children || null}</>;
}
