import { ProjectHydrator } from '@/components/admin/ProjectHydrator';
import { AdminClientLayout } from '@/components/admin/AdminClientLayout';
import { CleanUrlClient } from './CleanUrlClient';

export const runtime = 'edge';
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ alias: string }>;
}

export default async function AdminProjectPage({ params }: PageProps) {
  const resolvedParams = await params;
  const projectAlias = resolvedParams?.alias || 'default';
  
  const projectData = {
    id: projectAlias,
    custom_alias: projectAlias,
    title: 'Audiofolio Project',
    categories: [],
    is_offline_placeholder: true
  };

  return (
    <>
      <CleanUrlClient />
      <ProjectHydrator initialData={projectData} />
      <AdminClientLayout projects={[]} />
    </>
  );
}
