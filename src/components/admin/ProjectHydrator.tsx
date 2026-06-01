'use client';

import { useEffect, useRef } from 'react';
import { useProjectStore, ProjectData } from '@/store/projectStore';

interface ProjectHydratorProps {
  initialData?: ProjectData;
  project?: ProjectData;
  children?: React.ReactNode;
}

export function ProjectHydrator({ initialData, project, children }: ProjectHydratorProps) {
  const setProject = useProjectStore(state => state.setProject);
  const isHydrated = useRef(false);
  const data = initialData || project;

  useEffect(() => {
    if (data && !isHydrated.current) {
      setProject(data);
      isHydrated.current = true;
    }
  }, [data, setProject]);

  return <>{children || null}</>;
}
