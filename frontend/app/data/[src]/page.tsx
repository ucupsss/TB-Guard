import { Suspense } from 'react';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import { RequireAuth } from '@/components/auth/RequireAuth';
import View from '@/views/DataPage';

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="table" />}>
      <RequireAuth skeleton="table"><View /></RequireAuth>
    </Suspense>
  );
}
