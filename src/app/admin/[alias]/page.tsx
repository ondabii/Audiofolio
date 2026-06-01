import { ProjectHydrator } from '@/components/admin/ProjectHydrator';
import { AdminClientLayout } from '@/components/admin/AdminClientLayout';
import { getProjectData, getAllProjects } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import { CleanUrlClient } from './CleanUrlClient';

export const runtime = 'edge';

export default async function AdminProjectPage({ params }: { params: Promise<{ alias: string }> }) {
  const resolvedParams = await params;
  const projectAlias = resolvedParams.alias;
  
  if (!projectAlias || projectAlias === 'new' || projectAlias === 'index') {
    const randomHash = Math.random().toString(36).substring(2, 8);
    redirect(`/admin/project-${randomHash}`);
  }
  
  const [projectData, allProjects] = await Promise.all([
    getProjectData(projectAlias),
    getAllProjects()
  ]);
  
  if (!projectData) {
    notFound();
  }

  return (
    <>
      <CleanUrlClient />
      <ProjectHydrator initialData={projectData} />
      <AdminClientLayout projects={allProjects} />
    </>
  );
}
