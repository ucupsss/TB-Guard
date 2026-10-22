import { Suspense } from 'react';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import { RequireAuth } from '@/components/auth/RequireAuth';
import View from '@/views/CoughDetail';

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <RequireAuth skeleton="detail"><View /></RequireAuth>
    </Suspense>
  );
}
