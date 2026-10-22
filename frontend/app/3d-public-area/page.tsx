import { Suspense } from 'react';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import PublicArea3D from '@/views/PublicArea3D';

export const metadata = {
  title: '3D Public Area | TB Guard',
  description: 'Simulasi 3D Public Area penempatan sensor TB Guard di Stasiun Bandung',
};

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="design" />}>
      <PublicArea3D showCalculator={false} />
    </Suspense>
  );
}
