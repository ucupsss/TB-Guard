import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type SkeletonVariant = 'dashboard' | 'table' | 'grid' | 'detail' | 'kanban' | 'design' | 'form' | 'live' | 'login';

const Box = ({ className, children }: { className?: string; children?: React.ReactNode }) => (
  <div className={cn('box p-5', className)}>{children}</div>
);

const Lines = ({ n = 3 }: { n?: number }) => (
  <div className="space-y-2.5">{Array.from({ length: n }, (_, i) => <Skeleton key={i} className={cn('h-3', i === n - 1 ? 'w-2/3' : 'w-full')} />)}</div>
);

const Rows = ({ n = 8 }: { n?: number }) => (
  <Box className="space-y-4">
    <Skeleton className="h-4 w-full" />
    {Array.from({ length: n }, (_, i) => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-3 flex-1" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    ))}
  </Box>
);

/** isi kerangka per jenis halaman; dipakai di dalam AppLayout atau shell kerangka */
export function ContentSkeleton({ variant }: { variant: SkeletonVariant }) {
  switch (variant) {
    case 'dashboard':
      return (
        <div className="mt-6 grid grid-cols-12 gap-6">
          <Skeleton className="col-span-12 h-12" />
          <Box className="col-span-12 h-72 lg:col-span-6"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="mt-6 h-9 w-28" /><div className="mt-6"><Lines /></div></Box>
          <Box className="col-span-12 h-72 sm:col-span-6 lg:col-span-3"><Skeleton className="h-6 w-12" /><Skeleton className="mt-6 h-24 w-full" /><div className="mt-4"><Lines n={2} /></div></Box>
          <Box className="col-span-12 h-72 sm:col-span-6 lg:col-span-3"><Skeleton className="mx-auto mt-4 h-40 w-40 rounded-full" /><div className="mt-6"><Lines n={2} /></div></Box>
          <Box className="col-span-12 h-80 lg:col-span-8"><Skeleton className="h-full w-full" /></Box>
          <div className="col-span-12 space-y-4 lg:col-span-4">{[0, 1, 2].map((i) => <Box key={i} className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><div className="flex-1"><Lines n={2} /></div></Box>)}</div>
        </div>
      );
    case 'table':
      return (
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap gap-3"><Skeleton className="h-7 w-48" /><Skeleton className="ml-auto h-9 w-56" /><Skeleton className="h-9 w-28" /></div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Box key={i}><Skeleton className="h-4 w-20" /><Skeleton className="mt-3 h-7 w-16" /></Box>)}</div>
          <Rows />
        </div>
      );
    case 'grid':
      return (
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap gap-3"><Skeleton className="h-7 w-40" /><Skeleton className="ml-auto h-9 w-64" /><Skeleton className="h-9 w-32" /></div>
          <div className="grid grid-cols-12 gap-6">{Array.from({ length: 6 }, (_, i) => (
            <Box key={i} className="col-span-12 sm:col-span-6 xl:col-span-4"><div className="flex items-center gap-3"><Skeleton className="h-11 w-11 rounded-full" /><div className="flex-1"><Lines n={2} /></div></div><Skeleton className="mt-5 h-20 w-full" /></Box>
          ))}</div>
        </div>
      );
    case 'detail':
      return (
        <div className="mt-6 grid grid-cols-12 gap-6">
          <div className="col-span-12 flex gap-3"><Skeleton className="h-7 w-56" /><Skeleton className="ml-auto h-9 w-32" /></div>
          <Box className="col-span-12 lg:col-span-4"><Skeleton className="h-14 w-14 rounded-full" /><div className="mt-5"><Lines n={5} /></div></Box>
          <Box className="col-span-12 lg:col-span-8"><Skeleton className="h-5 w-40" /><Skeleton className="mt-4 h-48 w-full" /></Box>
          <div className="col-span-12"><Rows n={5} /></div>
        </div>
      );
    case 'kanban':
      return (
        <div className="mt-6 space-y-5">
          <div className="flex gap-3"><Skeleton className="h-8 w-52" /><Skeleton className="ml-auto h-9 w-28" /></div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Box key={i}><Skeleton className="h-3 w-14" /><Skeleton className="mt-3 h-8 w-10" /><Skeleton className="mt-3 h-1.5 w-full" /></Box>)}</div>
          <Skeleton className="h-10 w-full" />
          <div className="flex gap-4 overflow-hidden">{Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="w-[285px] shrink-0 space-y-3 rounded-xl bg-slate-100/70 p-3.5 dark:bg-slate-900/40 xl:flex-1">
              <Skeleton className="h-5 w-28" />
              {Array.from({ length: 2 + (i % 2) }, (_, j) => <Box key={j} className="p-4"><div className="flex items-center gap-2"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-3 flex-1" /></div><div className="mt-3"><Lines n={2} /></div></Box>)}
            </div>
          ))}</div>
        </div>
      );
    case 'design':
      return (
        <div className="mt-7 grid grid-cols-12 gap-4">
          <Box className="col-span-3 hidden space-y-3 lg:block">{Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="h-6 w-full" />)}</Box>
          <div className="col-span-12 space-y-3 lg:col-span-6"><div className="flex gap-2"><Skeleton className="h-9 w-80" /><Skeleton className="ml-auto h-9 w-24" /></div><Skeleton className="h-[60vh] w-full rounded-lg" /><Skeleton className="h-20 w-full" /></div>
          <Box className="col-span-3 hidden lg:block"><Skeleton className="h-6 w-32" /><div className="mt-5"><Lines n={6} /></div></Box>
        </div>
      );
    case 'form':
      return (
        <div className="mt-6 grid grid-cols-12 gap-6">
          <Box className="col-span-12 space-y-5 lg:col-span-8">{Array.from({ length: 5 }, (_, i) => <div key={i} className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-9 w-full" /></div>)}<Skeleton className="h-9 w-32" /></Box>
          <Box className="col-span-12 lg:col-span-4"><Skeleton className="h-5 w-32" /><div className="mt-5"><Lines n={6} /></div></Box>
        </div>
      );
    case 'live':
      return (
        <div className="mt-8 space-y-5">
          <div className="flex gap-2"><Skeleton className="h-7 w-64" /><Skeleton className="ml-auto h-6 w-28 rounded-full" /><Skeleton className="h-6 w-28 rounded-full" /></div>
          <Box className="grid grid-cols-12 gap-6">
            <div className="col-span-12 space-y-4 lg:col-span-6"><Skeleton className="h-40 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-24 w-full" /></div>
            <Skeleton className="col-span-12 h-72 lg:col-span-6" />
          </Box>
        </div>
      );
    case 'login':
      return null;
  }
}

/** kerangka satu layar penuh (sidebar + topbar + isi) selama sesi/halaman dimuat */
export function PageSkeleton({ variant = 'dashboard' }: { variant?: SkeletonVariant }) {
  if (variant === 'login') {
    return (
      <div role="status" aria-label="Memuat" className="grid min-h-screen bg-page lg:grid-cols-2">
        <div className="hidden bg-primary lg:block" />
        <div className="flex items-center justify-center p-8">
          <div className="w-full max-w-sm space-y-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
        </div>
      </div>
    );
  }
  return (
    <div role="status" aria-label="Memuat" className="flex min-h-screen bg-shell">
      <aside className="hidden w-[84px] shrink-0 flex-col items-center gap-6 pt-5 lg:flex">
        <Skeleton className="h-11 w-11 rounded-full bg-white/20 dark:bg-white/10" />
        <div className="h-px w-10 bg-white/10" />
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-6 w-6 bg-white/20 dark:bg-white/10" />)}
      </aside>
      <main className="min-h-screen min-w-0 flex-1 bg-page px-4 pb-10 md:px-[22px] lg:my-3 lg:mr-3 lg:min-h-[calc(100vh-24px)] lg:rounded-shell">
        <div className="flex h-[67px] items-center gap-3 border-b border-slate-200/60 dark:border-white/10">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto hidden h-9 w-56 rounded-full sm:block" />
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
        <ContentSkeleton variant={variant} />
      </main>
    </div>
  );
}
