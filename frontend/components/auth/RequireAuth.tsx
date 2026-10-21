'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';

/** Halaman hanya tampil setelah login (sesi demo di sessionStorage).
 *  ?preview=1 masuk otomatis dengan akun demo, berguna untuk cek tampilan. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, ready, login } = useStore();
  const router = useRouter();
  const preview = useSearchParams()?.get('preview');

  React.useEffect(() => {
    if (!ready || user) return;
    if (preview) login({ email: 'admin.tbguard@gmail.com', role: 'Admin', name: 'Admin' });
    else router.replace('/login');
  }, [ready, user, preview, login, router]);

  if (!ready || !user) return null;
  return <>{children}</>;
}
