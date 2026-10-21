'use client';

import * as React from 'react';
import { CheckCircledIcon, CrossCircledIcon, GearIcon } from '@radix-ui/react-icons';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { initials, personHue, statusLabel } from '@/lib/format';
import { envelope } from '@/lib/audio';
import type { Detection, DeviceStatus } from '@/lib/types';

/** judul seksi seperti "General Report" + slot kanan */
export function SectionHeader({ title, children, className }: { title: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('intro-y mb-5 flex h-10 items-center', className)}>
      <h2 className="section-title">{title}</h2>
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}

export function DeviceStatus({ status, className }: { status: DeviceStatus; className?: string }) {
  const Icon = status === 'active' ? CheckCircledIcon : status === 'inactive' ? CrossCircledIcon : GearIcon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', status === 'active' ? 'text-success' : 'text-danger', className)}>
      <Icon className="h-4 w-4" />{statusLabel[status]}
    </span>
  );
}

export function ResultBadge({ result, className }: { result: 'TB' | 'NEG'; className?: string }) {
  return result === 'TB'
    ? <Badge variant="soft-danger" className={className}>Terindikasi TB</Badge>
    : <Badge variant="soft-success" className={className}>Negatif TB</Badge>;
}

export function PersonAvatar({ name, className }: { name: string; className?: string }) {
  const h = personHue(name || '?');
  return (
    <Avatar className={cn('h-10 w-10', className)}>
      <AvatarFallback style={{ background: `hsl(${h} 60% 90%)`, color: `hsl(${h} 50% 28%)` }} className="text-xs font-medium">{initials(name || '?')}</AvatarFallback>
    </Avatar>
  );
}

/** gelombang mini dari rekaman (sintetis) */
export function WaveThumb({ d, className }: { d: Detection; className?: string }) {
  const env = React.useMemo(() => envelope(d.uuid, d.result === 'TB', d.type === '-' ? 1 : d.coughs, 24), [d.uuid, d.result, d.type, d.coughs]);
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect width="48" height="48" fill={d.result === 'TB' ? '#fde8e8' : '#e8eefb'} />
      {env.map((v, i) => { const h = Math.max(2, v * 30); return <rect key={i} x={6 + i * 1.5} y={24 - h / 2} width="1" height={h} fill={d.result === 'TB' ? '#D32929' : '#1C3FAA'} />; })}
    </svg>
  );
}

/** kipas arah mini */
export function DoaThumb({ az, className }: { az: number; className?: string }) {
  const r = (az * Math.PI) / 180, x = 24 + 18 * Math.sin(r), y = 34 - 18 * Math.cos(r);
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect width="48" height="48" fill="#eef2ff" />
      <path d="M6 34 A18 18 0 0 1 42 34 Z" fill="#c7d2fe" />
      <line x1="24" y1="34" x2={x} y2={y} stroke="#1C3FAA" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="24" cy="34" r="2.5" fill="#1C3FAA" />
    </svg>
  );
}

/** potongan kamera mini */
export function CamThumb({ tracked, className }: { tracked: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect width="48" height="48" fill="#1f2a44" />
      <circle cx="24" cy="18" r="6" fill="#4b5d86" />
      <path d="M14 44 V32 q0-6 6-6 h8 q6 0 6 6 V44 Z" fill="#4b5d86" />
      {tracked && <rect x="11" y="9" width="26" height="37" fill="none" stroke="#FBC500" strokeWidth="2" />}
    </svg>
  );
}

/** tiga gambar bertumpuk seperti kolom "Images" di template */
export function DetectionThumbs({ d }: { d: Detection }) {
  const cls = 'h-10 w-10 overflow-hidden rounded-full shadow-[0px_0px_0px_2px_#fff,_1px_1px_5px_rgba(0,0,0,0.32)] dark:shadow-[0px_0px_0px_2px_#3f4865]';
  return (
    <div className="flex">
      <div className={cls} title="Gelombang suara"><WaveThumb d={d} className="h-full w-full" /></div>
      <div className={cn(cls, '-ml-5')} title="Arah suara"><DoaThumb az={d.doa.azimuth} className="h-full w-full" /></div>
      <div className={cn(cls, '-ml-5')} title="Kamera"><CamThumb tracked={d.person.tracked} className="h-full w-full" /></div>
    </div>
  );
}

/** gauge confidence melingkar (v3) */
export function Gauge({ value, tb, size = 168 }: { value: number; tb: boolean; size?: number }) {
  const R = 70, C = 2 * Math.PI * R;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox="0 0 168 168" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="84" cy="84" r={R} fill="none" className="stroke-slate-100 dark:stroke-white/10" strokeWidth="14" />
        <circle cx="84" cy="84" r={R} fill="none" stroke={tb ? '#D32929' : '#1C3FAA'} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${(C * value).toFixed(1)} ${C.toFixed(1)}`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div><div className="text-2xl font-medium num">{(value * 100).toFixed(1).replace('.', ',')}%</div><div className="text-xs text-muted-foreground">confidence</div></div>
      </div>
    </div>
  );
}

/** pill naik/turun hijau-merah seperti "47% ↑" */
export function DeltaPill({ value, goodWhenUp = true, suffix = '%' }: { value: number; goodWhenUp?: boolean; suffix?: string }) {
  const good = value === 0 ? null : (value > 0) === goodWhenUp;
  return (
    <Badge variant={good === null ? 'secondary' : good ? 'success' : 'destructive'} className="num">
      {value > 0 ? '+' : value < 0 ? '−' : ''}{Math.abs(value)}{suffix} {value > 0 ? '↑' : value < 0 ? '↓' : ''}
    </Badge>
  );
}
