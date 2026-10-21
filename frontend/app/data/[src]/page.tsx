import { Suspense } from 'react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import View from '@/views/DataPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RequireAuth><View /></RequireAuth>
    </Suspense>
  );
}
