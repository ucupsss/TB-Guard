'use client';

import dynamic from 'next/dynamic';
import { AppLayout } from '@/components/layout/AppLayout';
import '@/components/design/design.css';

const Editor = dynamic(() => import('@/components/design/App'), {
  ssr: false,
  loading: () => <div className="grid min-h-[500px] place-items-center text-muted-foreground" role="status">Memuat editor prototipe 3D…</div>,
});

export default function Design() {
  return (
    <AppLayout crumbs={[{ label: '3D Prototype' }]}>
      <div className="mb-5 mt-7">
        <h1 className="text-xl font-semibold">3D Prototype Studio</h1>
        <p className="mt-1 text-sm text-muted-foreground">Eksplorasi prototipe TB Guard, susunan komponen, dan koneksi perangkat. Putar model, periksa bagian dalam, lalu simpan atau ekspor desain Anda.</p>
      </div>
      <div className="design-workspace"><Editor /></div>
    </AppLayout>
  );
}
