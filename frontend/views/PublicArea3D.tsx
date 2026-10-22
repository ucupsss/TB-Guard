'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { ContentSkeleton, PageSkeleton } from '@/components/layout/PageSkeleton';
import { useStore } from '@/lib/store';
import '@/components/public-area/public-area.css';

const Scene = dynamic(() => import('@/components/public-area/PublicAreaScene'), {
  ssr: false,
  loading: () => <div role="status" aria-label="Memuat aula 3D"><ContentSkeleton variant="design" /></div>,
});

/** beranda: tamu melihat simulasi tanpa sidebar, pengguna login melihatnya di dalam aplikasi */
export default function PublicArea3D() {
  const { user, ready } = useStore();
  if (!ready) return <PageSkeleton variant="design" />;

  return <AppLayout crumbs={[{ label: '3D Public Area' }]} guest={!user}>
    <header className="pa-heading"><div><p className="pa-eyebrow">DEPLOYMENT EXPLORER / 01</p><h1>3D Public Area</h1><p>Stasiun Gubeng <span> · </span> Surabaya, Indonesia</p></div>
      <Link href={user ? '/live-test' : '/login'} className="pa-live-link">{user ? 'Uji Suara & Kamera ↗' : 'Masuk ke Dashboard ↗'}</Link></header>
    <Scene />
  </AppLayout>;
}
