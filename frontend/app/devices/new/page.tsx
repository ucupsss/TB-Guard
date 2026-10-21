import { Suspense } from 'react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import View from '@/views/AddDevice';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RequireAuth><View /></RequireAuth>
    </Suspense>
  );
}
