import React from 'react';
import AdminPinGate from '@/components/admin/AdminPinGate';

export const metadata = {
  title: 'Audiofolio Admin Dashboard',
  description: 'Manage your audio portfolios, categories and track versions.',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminPinGate>
      {children}
    </AdminPinGate>
  );
}