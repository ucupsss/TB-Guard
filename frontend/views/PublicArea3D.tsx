'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { ContentSkeleton, PageSkeleton } from '@/components/layout/PageSkeleton';
import { useStore } from '@/lib/store';
import { SavingsCalculatorPopup } from '@/components/public-area/SavingsCalculatorPopup';
import '@/components/public-area/public-area.css';

const Scene = dynamic(() => import('@/components/public-area/PublicAreaScene'), {
  ssr: false,
  loading: () => <div role="status" aria-label="Memuat aula 3D"><ContentSkeleton variant="design" /></div>,
});

export interface PublicArea3DProps {
  showCalculator?: boolean;
}

/** 
 * Simulasi 3D TB Guard:
 * - Pada / (Home publik): showCalculator = true (menampilkan pop-up kalkulator untuk juri)
 * - Pada /3d-public-area: showCalculator = false (di dalam navigasi aplikasi, tanpa kalkulator)
 */
export default function PublicArea3D({ showCalculator }: PublicArea3DProps) {
  const { user, ready } = useStore();
  const pathname = usePathname();
  if (!ready) return <PageSkeleton variant="design" />;

  const isHome = pathname === '/';
  const shouldShowCalculator = showCalculator !== undefined ? showCalculator : isHome;

  return (
    <AppLayout crumbs={[{ label: '3D Design', to: '/design' }, { label: '3D Public Area' }]} guest={!user}>
      <header className="pa-heading">
        <div>
          <p className="pa-eyebrow">DEPLOYMENT EXPLORER / 01</p>
          <h1>3D Public Area</h1>
          <p>Stasiun Bandung <span> · </span> Bandung, Indonesia</p>
        </div>
        <Link href={user ? '/live-test' : '/login'} className="pa-live-link">
          {user ? 'Uji Suara & Kamera ↗' : 'Masuk ke Dashboard ↗'}
        </Link>
      </header>
      <Scene />
      {shouldShowCalculator && <SavingsCalculatorPopup />}
    </AppLayout>
  );
}
