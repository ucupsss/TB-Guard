'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BellIcon, ExitIcon, HamburgerMenuIcon, LockClosedIcon, MagicWandIcon, MagnifyingGlassIcon, PersonIcon, SpeakerLoudIcon } from '@radix-ui/react-icons';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useStore } from '@/lib/store';
import { useAgent } from '@/components/agent/AgentProvider';
import { fmt, initials } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface Crumb { label: string; to?: string }

export function TopBar({ crumbs, onMenu }: { crumbs: Crumb[]; onMenu: () => void }) {
  const { user, detections, devices, patients, device, logout } = useStore();
  const router = useRouter();
  const agent = useAgent();
  const pending = detections.filter((d) => d.result === 'TB' && !d.reviewed).sort((a, b) => b.time - a.time);
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const hits = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return [
      ...devices.filter((d) => [d.name, d.location, d.zone, d.id].join(' ').toLowerCase().includes(s)).map((d) => ({ key: 'd' + d.id, group: 'Perangkat', label: d.name, meta: d.location, to: `/devices/${d.id}` })),
      ...detections.filter((d) => (d.uuid + ' ' + d.name).toLowerCase().includes(s)).map((d) => ({ key: d.uuid, group: 'Deteksi', label: d.uuid, meta: `${device(d.deviceId)?.name} · ${d.result === 'TB' ? 'Terindikasi TB' : 'Negatif TB'}`, to: `/detections/${d.uuid}` })),
      ...patients.filter((p) => (p.name + ' ' + p.id).toLowerCase().includes(s)).map((p) => ({ key: p.id, group: 'Pasien', label: p.name, meta: p.id, to: `/patients?open=${p.id}` })),
    ].slice(0, 7);
  }, [q, devices, detections, patients, device]);

  React.useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === '/' && !/input|textarea|select/i.test((e.target as HTMLElement).tagName)) { e.preventDefault(); inputRef.current?.focus(); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);

  const go = (to: string) => { setOpen(false); setQ(''); router.push(to); };

  return (
    <div className="relative z-[51] flex h-[67px] items-center border-b border-slate-200 dark:border-white/10">
      <button className="mr-3 rounded-md p-1.5 text-muted-foreground hover:bg-black/5 lg:hidden" onClick={onMenu} aria-label="Buka menu"><HamburgerMenuIcon className="h-5 w-5" /></button>
      <Breadcrumb className="mr-auto hidden sm:block">
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink asChild><Link href="/">Application</Link></BreadcrumbLink></BreadcrumbItem>
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>{i === crumbs.length - 1 || !c.to ? <BreadcrumbPage className="text-primary dark:text-blue-300">{c.label}</BreadcrumbPage> : <BreadcrumbLink asChild><Link href={c.to}>{c.label}</Link></BreadcrumbLink>}</BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="mr-auto sm:hidden font-medium">{crumbs[crumbs.length - 1]?.label}</div>

      {/* pencarian */}
      <Popover open={open && hits.length > 0} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative mr-3 hidden sm:mr-6 sm:block">
            <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
              onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) go(hits[0].to); if (e.key === 'Escape') setOpen(false); }}
              placeholder="Search..." aria-label="Cari perangkat, UUID, atau pasien"
              className="h-9 w-56 rounded-full border-transparent bg-slate-300/50 px-4 pr-8 text-sm shadow-none outline-none transition-[width] placeholder:text-slate-500 focus:w-72 focus:ring-2 focus:ring-primary/30 dark:bg-white/10 dark:placeholder:text-slate-400" />
            <MagnifyingGlassIcon className="absolute inset-y-0 right-0 my-auto mr-3 h-4 w-4 text-slate-600 dark:text-slate-400" />
          </div>
        </PopoverAnchor>
        <PopoverContent align="end" className="w-80 p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
          {['Perangkat', 'Deteksi', 'Pasien'].map((g) => {
            const list = hits.filter((h) => h.group === g);
            if (!list.length) return null;
            return (
              <div key={g} className="mb-1">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">{g}</div>
                {list.map((h) => (
                  <button key={h.key} onClick={() => go(h.to)} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent">
                    <span className="font-medium">{h.label}</span><span className="truncate pl-3 text-xs text-muted-foreground">{h.meta}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </PopoverContent>
      </Popover>

      {/* agen AI */}
      <button type="button" onClick={agent.toggle} aria-pressed={agent.open} title="TB Guard Agent (Ctrl+I)"
        className={cn('mr-4 inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-ring sm:mr-6',
          agent.open ? 'bg-primary text-white shadow-box' : 'bg-primary/10 text-primary hover:bg-primary/15 dark:bg-white/10 dark:text-blue-200')}>
        <MagicWandIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Agent</span>
        {agent.running && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pending" />}
      </button>

      {/* notifikasi */}
      <DropdownMenu>
        <DropdownMenuTrigger className="relative mr-4 rounded-full p-1 text-slate-600 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:mr-6 dark:text-slate-300" aria-label={`${pending.length} peringatan TB belum ditinjau`}>
          <BellIcon className="h-5 w-5" />
          {pending.length > 0 && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-danger ring-2 ring-page" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 p-4 sm:w-[350px]">
          <div className="mb-4 font-medium">Notifikasi <span className="text-muted-foreground">· {pending.length} peringatan TB</span></div>
          {pending.slice(0, 5).map((d) => (
            <DropdownMenuItem key={d.uuid} className="mb-3 items-start gap-3 p-1 last:mb-0" onSelect={() => router.push(`/detections/${d.uuid}`)}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-danger/10 text-danger"><SpeakerLoudIcon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2"><b className="truncate font-medium">{device(d.deviceId)?.name}</b><span className="whitespace-nowrap text-xs text-muted-foreground">{fmt.ago(d.time)}</span></span>
                <span className="block truncate text-muted-foreground">Batuk terindikasi TB · conf. {d.confidence.toFixed(2)}</span>
              </span>
            </DropdownMenuItem>
          ))}
          {pending.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada peringatan baru.</p>}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* akun */}
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Menu akun">
          <Avatar className="h-8 w-8 shadow-lg ring-2 ring-white dark:ring-white/10"><AvatarFallback className="bg-primary text-xs text-white">{initials(user?.name || 'A')}</AvatarFallback></Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={cn('w-56 border-0 bg-[#1e3a8a] p-2 text-white')}>
          <DropdownMenuLabel className="font-normal">
            <div className="font-medium">{user?.name}</div>
            <div className="text-xs text-white/60">{user?.role} · {user?.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem className="focus:bg-white/10 focus:text-white" onSelect={() => router.push('/patients')}><PersonIcon />Pelacakan pasien</DropdownMenuItem>
          <DropdownMenuItem className="focus:bg-white/10 focus:text-white" onSelect={() => router.push('/devices')}><LockClosedIcon />Perangkat</DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem className="focus:bg-white/10 focus:text-white" onSelect={() => { logout(); router.push('/login'); }}><ExitIcon />Logout</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
