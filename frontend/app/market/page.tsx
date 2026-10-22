import { Suspense } from 'react';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import { RequireAuth } from '@/components/auth/RequireAuth';
import Market from '@/views/Market';

export default function Page() {
  return <Suspense fallback={<PageSkeleton variant="dashboard" />}><RequireAuth skeleton="dashboard"><Market /></RequireAuth></Suspense>;
}
