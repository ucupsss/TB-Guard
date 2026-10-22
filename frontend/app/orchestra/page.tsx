import { Suspense } from 'react';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import { RequireAuth } from '@/components/auth/RequireAuth';
import OrchestraView from '@/views/OrchestraView';

export const metadata = {
  title: 'Orchestra AI | TB Guard',
  description: 'Hierarchical Multi-Agent Orchestration Engine',
};

export default function Page() {
  return <Suspense fallback={<PageSkeleton variant="dashboard" />}><RequireAuth skeleton="dashboard"><OrchestraView /></RequireAuth></Suspense>;
}
