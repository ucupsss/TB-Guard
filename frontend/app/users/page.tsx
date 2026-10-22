import { Suspense } from 'react';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import { RequireAuth } from '@/components/auth/RequireAuth';
import Users from '@/views/Users';

export default function Page() {
  return <Suspense fallback={<PageSkeleton variant="table" />}><RequireAuth skeleton="table"><Users /></RequireAuth></Suspense>;
}
