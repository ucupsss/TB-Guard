import { Suspense } from 'react';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import BusinessPotential from '@/views/BusinessPotential';

export const metadata = {
  title: 'Potensi Bisnis & Regulasi | TB Guard',
  description: 'Analisis kelayakan komersial B2B/B2G, stakeholder pembayar, dan dasar peraturan pemerintah TB Guard',
};

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="dashboard" />}>
      <BusinessPotential />
    </Suspense>
  );
}
