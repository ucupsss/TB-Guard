import { Suspense } from 'react';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import { RequireAuth } from '@/components/auth/RequireAuth';
import View from '@/views/Devices';

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="grid" />}>
      <RequireAuth skeleton="grid"><View /></RequireAuth>
    </Suspense>
  );
}
