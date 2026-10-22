import { Suspense } from 'react';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import { RequireAuth } from '@/components/auth/RequireAuth';
import View from '@/views/LiveTestView';

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="live" />}>
      <RequireAuth skeleton="live"><View /></RequireAuth>
    </Suspense>
  );
}
