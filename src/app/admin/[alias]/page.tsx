import { ProjectHydrator } from '@/components/admin/ProjectHydrator';
import { AdminClientLayout } from '@/components/admin/AdminClientLayout';
import { CleanUrlClient } from './CleanUrlClient';

export async function generateStaticParams() {
  return [{ alias: 'default' }];
}
export const dynamicParams = false;

export default async function AdminProjectPage({ params }: { params: Promise<{ alias: string }> }) {
  const resolvedParams = await params;
  const projectAlias = resolvedParams?.alias || 'offline';
  
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
