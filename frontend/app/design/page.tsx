import { Suspense } from 'react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import Design from '@/views/Design';

export default function Page() {
  return <Suspense fallback={null}><RequireAuth><Design /></RequireAuth></Suspense>;
}
