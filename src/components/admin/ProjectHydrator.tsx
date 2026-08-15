'use client';

import { useEffect, useRef } from 'react';
import { useProjectStore, ProjectData } from '@/store/projectStore';
import { saveProjectToLocalStorage, getProjectFromLocalStorage } from '@/lib/offlineCache';

interface ProjectHydratorProps {
  initialData?: ProjectData;
  project?: ProjectData;
  children?: React.ReactNode;
  isAdmin?: boolean;
}

export function ProjectHydrator({ initialData, project, children, isAdmin = false }: ProjectHydratorProps) {
  const setProject = useProjectStore(state => state.setProject);
  const isHydrated = useRef(false);
  const data = (initialData || project) as any;

  useEffect(() => {
    async function hydrateData() {
      const alias = data?.custom_alias || data?.short_id || data?.id;

      // 1. 실시간 D1 데이터베이스 API (/api/projects/[alias])에서 상세 데이터 페칭
      if (alias) {
        try {
          const queryUrl = isAdmin ? `/api/projects/${alias}?admin=true` : `/api/projects/${alias}`;
          const res = await fetch(queryUrl);
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
          console.warn("Failed to fetch D1 project details, trying local cache:", e);
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
