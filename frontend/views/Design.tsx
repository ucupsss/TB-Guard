'use client';

import dynamic from 'next/dynamic';
import { AppLayout } from '@/components/layout/AppLayout';
import { ContentSkeleton } from '@/components/layout/PageSkeleton';
import '@/components/design/design.css';

const Editor = dynamic(() => import('@/components/design/App'), {
  ssr: false,
  loading: () => <div role="status" aria-label="Memuat editor 3D"><ContentSkeleton variant="design" /></div>,
});

export default function Design() {
  return (
    <AppLayout crumbs={[{ label: '3D Prototype' }]}>
      <div className="mb-5 mt-7">
        <h1 className="text-xl font-semibold">3D Prototype Studio</h1>
      </div>
      <div className="design-workspace"><Editor /></div>
    </AppLayout>
  );
}
