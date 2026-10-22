'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { PageSkeleton, type SkeletonVariant } from '@/components/layout/PageSkeleton';

/** Halaman hanya tampil setelah login Google (sesi di sessionStorage, diverifikasi backend). */
export function RequireAuth({ children, skeleton = 'dashboard' }: { children: React.ReactNode; skeleton?: SkeletonVariant }) {
  const { user, ready } = useStore();
  const router = useRouter();

  React.useEffect(() => {
    if (!ready || user) return;
    router.replace('/login');
  }, [ready, user, router]);

  if (!ready || !user) return <PageSkeleton variant={skeleton} />;
  return <>{children}</>;
}
