import { Suspense } from 'react';
import { PageSkeleton } from '@/components/layout/PageSkeleton';

import View from '@/views/Login';

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="login" />}>
      <View />
    </Suspense>
  );
}
