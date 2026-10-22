import { Suspense } from 'react';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import { RequireAuth } from '@/components/auth/RequireAuth';
import View from '@/views/Patients';

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="kanban" />}>
      <RequireAuth skeleton="kanban"><View /></RequireAuth>
    </Suspense>
  );
}
