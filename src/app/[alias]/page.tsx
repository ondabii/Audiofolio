import { ProjectHydrator } from '@/components/admin/ProjectHydrator';
import { PublicClientLayout } from '@/components/public/PublicClientLayout';
import { PinGate } from '@/components/public/PinGate';

export const dynamicParams = true;

export default async function ProjectPublicPage({ params }: { params: Promise<{ alias: string }> }) {
  const p = await params;
  
  const project = {
    id: p?.alias || 'offline',
    custom_alias: p?.alias || 'offline',
    title: 'Audiofolio Project',
    categories: [],
    is_offline_placeholder: true
  };

  return (
    <ProjectHydrator project={project}>
      <PinGate>
        <PublicClientLayout />
      </PinGate>
    </ProjectHydrator>
  );
}
