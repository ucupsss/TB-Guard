import { Suspense } from 'react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import View from '@/views/DeviceDetail';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RequireAuth><View /></RequireAuth>
    </Suspense>
  );
}
