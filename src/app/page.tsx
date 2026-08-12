'use client';

import AdminPinGate from '@/components/admin/AdminPinGate';
import { DashboardClient } from '@/components/admin/DashboardClient';

export default function Home() {
  return (
    <AdminPinGate>
      <DashboardClient initialProjects={[]} />
    </AdminPinGate>
  );
}
