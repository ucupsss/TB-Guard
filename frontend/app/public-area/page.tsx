import { Suspense } from 'react';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import { RequireAuth } from '@/components/auth/RequireAuth';
import PublicArea3D from '@/views/PublicArea3D';

export default function Page() {
  return <Suspense fallback={<PageSkeleton variant="design" />}><RequireAuth skeleton="design"><PublicArea3D /></RequireAuth></Suspense>;
}
