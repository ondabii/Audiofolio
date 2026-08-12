import { ProjectHydrator } from '@/components/admin/ProjectHydrator';
import { PublicClientLayout } from '@/components/public/PublicClientLayout';
import { PinGate } from '@/components/public/PinGate';

export const dynamicParams = true;

interface PageProps {
  params: Promise<{ alias: string }>;
}

export default async function ProjectPublicPage({ params }: PageProps) {
  const resolvedParams = await params;
  const alias = resolvedParams?.alias || 'default';
  
  const project = {
    id: alias,
    custom_alias: alias,
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
