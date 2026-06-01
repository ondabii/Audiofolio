import { getProjectData } from '@/lib/db';
import { notFound } from 'next/navigation';
import { ProjectHydrator } from '@/components/admin/ProjectHydrator';
import { PublicClientLayout } from '@/components/public/PublicClientLayout';
import { PinGate } from '@/components/public/PinGate';

export const runtime = 'edge';

export default async function ProjectPublicPage({ params }: { params: Promise<{ alias: string }> }) {
  const p = await params;
  const project = await getProjectData(p.alias);

  if (!project) {
    notFound();
  }

  return (
    <ProjectHydrator project={project}>
      <PinGate>
        <PublicClientLayout />
      </PinGate>
    </ProjectHydrator>
  );
}
