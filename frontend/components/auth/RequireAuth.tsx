'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { PageSkeleton, type SkeletonVariant } from '@/components/layout/PageSkeleton';

/** Halaman hanya tampil setelah login Google (sesi di sessionStorage, diverifikasi backend). */
export function RequireAuth({ children, skeleton = 'dashboard' }: { children: React.ReactNode; skeleton?: SkeletonVariant }) {
  const { user, ready, loaded, loadError, reload } = useStore();
  const router = useRouter();

  React.useEffect(() => {
    if (!ready || user) return;
    router.replace('/login');
  }, [ready, user, router]);

  if (!ready || !user) return <PageSkeleton variant={skeleton} />;
  if (loadError && !loaded) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-foreground">{loadError}</p>
        <button type="button" onClick={reload} className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:opacity-90">Coba lagi</button>
      </div>
    );
  }
  if (!loaded) return <PageSkeleton variant={skeleton} />;
  return <>{children}</>;
}
