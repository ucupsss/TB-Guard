import { Suspense } from 'react';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import { RequireAuth } from '@/components/auth/RequireAuth';
import View from '@/views/AddDevice';

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="form" />}>
      <RequireAuth skeleton="form"><View /></RequireAuth>
    </Suspense>
  );
}
