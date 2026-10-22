import { Suspense } from 'react';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import { RequireAuth } from '@/components/auth/RequireAuth';
import Design from '@/views/Design';

export default function Page() {
  return <Suspense fallback={<PageSkeleton variant="design" />}><RequireAuth skeleton="design"><Design /></RequireAuth></Suspense>;
}
