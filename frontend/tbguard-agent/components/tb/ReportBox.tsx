'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** kotak laporan ala template: ikon berwarna, pill di kanan atas, angka besar, label */
export function ReportBox({ icon: Icon, color, value, label, pill, pillVariant = 'success', active, onClick }: {
  icon: LucideIcon; color: string; value: React.ReactNode; label: string; pill?: string; pillVariant?: 'success' | 'destructive' | 'secondary' | 'warning'; active?: boolean; onClick?: () => void;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <div className="intro-y relative before:absolute before:inset-x-3 before:top-0 before:h-full before:translate-y-2 before:rounded-md before:bg-slate-50 before:shadow-box before:content-[''] dark:before:bg-white/5">
      <Comp onClick={onClick} aria-pressed={onClick ? active : undefined}
        className={cn('box relative block w-full p-5 text-left transition', onClick && 'hover:shadow-box-lg', active && 'ring-2 ring-primary')}>
        <div className="flex">
          <Icon className={cn('h-7 w-7', color)} strokeWidth={1.5} />
          {pill && <Badge variant={pillVariant} className="ml-auto self-start">{pill}</Badge>}
        </div>
        <div className="mt-6 text-3xl font-medium leading-8 num">{value}</div>
        <div className="mt-1 text-base text-muted-foreground">{label}</div>
      </Comp>
    </div>
  );
}
