import { Suspense } from 'react';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import { RequireAuth } from '@/components/auth/RequireAuth';
import View from '@/views/Dashboard';

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="dashboard" />}>
      <RequireAuth skeleton="dashboard"><View /></RequireAuth>
    </Suspense>
  );
}
