import { Suspense } from 'react';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import PublicArea3D from '@/views/PublicArea3D';

/** beranda publik: simulasi 3D TB Guard Agent, tampil sebelum login */
export default function Page() {
  return <Suspense fallback={<PageSkeleton variant="design" />}><PublicArea3D /></Suspense>;
}
