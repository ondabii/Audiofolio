import { getAllProjects } from '@/lib/db';
import { DashboardClient } from '@/components/admin/DashboardClient';

export const runtime = 'edge';

export default async function AdminPage() {
  const projects = await getAllProjects();

  return (
    <DashboardClient initialProjects={projects} />
  );
}
