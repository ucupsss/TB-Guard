'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { ContentSkeleton } from '@/components/layout/PageSkeleton';
import '@/components/public-area/public-area.css';

const Scene = dynamic(() => import('@/components/public-area/PublicAreaScene'), {
  ssr: false,
  loading: () => <div role="status" aria-label="Memuat aula 3D"><ContentSkeleton variant="design" /></div>,
});

export default function PublicArea3D() {
  return <AppLayout crumbs={[{ label: '3D Public Area' }]}>
    <header className="pa-heading"><div><p className="pa-eyebrow">DEPLOYMENT EXPLORER / 01</p><h1>3D Public Area</h1><p>Stasiun Gubeng <span> · </span> Surabaya, Indonesia</p></div><Link href="/live-test" className="pa-live-link">Uji Suara & Kamera ↗</Link></header>
    <Scene />
  </AppLayout>;
}
