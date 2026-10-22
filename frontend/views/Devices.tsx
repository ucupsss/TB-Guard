'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClockIcon, CubeIcon, GearIcon, Link2Icon, LinkBreak2Icon, MagnifyingGlassIcon, PlusIcon, SewingPinIcon } from '@radix-ui/react-icons';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ReportBox } from '@/components/tb/ReportBox';
import { DeviceStatus } from '@/components/tb/common';
import { useStore } from '@/lib/store';
import { useUiCommand } from '@/lib/agent/ui-bus';
import { fmt } from '@/lib/format';
import type { DeviceStatus as S } from '@/lib/types';

export default function Devices() {
  const { devices, detections } = useStore();
  const router = useRouter();
  const [filter, setFilter] = React.useState<'' | S>('');
  const [q, setQ] = React.useState('');
  // filter diterapkan oleh agen AI di depan pengguna
  useUiCommand('filter-devices', (c) => { setFilter(c.status ?? ''); setQ(c.query ?? ''); });
  const count = (s: S) => devices.filter((d) => d.status === s).length;
  const list = devices.filter((d) => (!filter || d.status === filter) && (!q || [d.name, d.location, d.zone, d.id, d.type].join(' ').toLowerCase().includes(q.toLowerCase())));

  return (
    <AppLayout crumbs={[{ label: 'Devices', to: '/devices' }, { label: 'Device List' }]}>
      <div className="intro-y mt-8 flex items-center">
        <h2 className="mr-auto text-lg font-medium">Device List</h2>
        <Button onClick={() => router.push('/devices/new')}><PlusIcon />Add Device</Button>
      </div>

      <div className="mt-5 grid grid-cols-12 gap-6">
        <div className="col-span-12 sm:col-span-4"><ReportBox icon={Link2Icon} color="text-success" value={count('active')} label="Active" pill={`${fmt.pct(count('active') / devices.length, 0)}`} active={filter === 'active'} onClick={() => setFilter(filter === 'active' ? '' : 'active')} /></div>
        <div className="col-span-12 sm:col-span-4"><ReportBox icon={LinkBreak2Icon} color="text-pending" value={count('inactive')} label="Inactive" pill={`${fmt.pct(count('inactive') / devices.length, 0)}`} pillVariant="warning" active={filter === 'inactive'} onClick={() => setFilter(filter === 'inactive' ? '' : 'inactive')} /></div>
        <div className="col-span-12 sm:col-span-4"><ReportBox icon={GearIcon} color="text-danger" value={count('broken')} label="Broken" pill={`${fmt.pct(count('broken') / devices.length, 0)}`} pillVariant="destructive" active={filter === 'broken'} onClick={() => setFilter(filter === 'broken' ? '' : 'broken')} /></div>
      </div>

      <div className="intro-y mt-8 flex flex-wrap items-center gap-3">
        <ToggleGroup type="single" value={filter || 'all'} onValueChange={(v) => setFilter(v === 'all' || !v ? '' : (v as S))} className="box p-1">
          <ToggleGroupItem value="all" size="sm">Semua</ToggleGroupItem>
          <ToggleGroupItem value="active" size="sm">Active</ToggleGroupItem>
          <ToggleGroupItem value="inactive" size="sm">Inactive</ToggleGroupItem>
          <ToggleGroupItem value="broken" size="sm">Broken</ToggleGroupItem>
        </ToggleGroup>
        <div className="hidden text-muted-foreground md:block">Menampilkan {list.length} dari {devices.length} perangkat</div>
        <div className="relative w-full sm:ml-auto sm:w-56">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type here to search..." className="box border-0 pr-9" aria-label="Cari perangkat" />
          <MagnifyingGlassIcon className="absolute inset-y-0 right-0 my-auto mr-3 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-12 gap-6">
        {list.map((d) => {
          const all = detections.filter((x) => x.deviceId === d.id), tb = all.filter((x) => x.result === 'TB').length;
          return (
            <div key={d.id} className="intro-y col-span-12 md:col-span-6 xl:col-span-3">
              <div className="box transition-all duration-200 hover:-translate-y-1 hover:shadow-box-lg">
                <div className="flex flex-col items-center p-5 text-center">
                  <div className="relative grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary dark:text-blue-300">
                    <CubeIcon className="h-8 w-8" />
                    <span className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card ${d.status === 'active' ? 'bg-success' : d.status === 'inactive' ? 'bg-pending' : 'bg-danger'}`} />
                  </div>
                  <Link href={`/devices/${d.id}`} className="mt-3 text-base font-medium hover:text-primary">{d.name}</Link>
                  <div className="mt-0.5 text-muted-foreground">TB Guard Device · ID {d.id}</div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><SewingPinIcon className="h-3.5 w-3.5" />{d.location} · {d.zone.split(' – ')[0]}</div>
                </div>
                <div className="grid grid-cols-3 border-y border-slate-200/70 text-center dark:border-white/10">
                  <div className="py-3"><div className="text-xs text-muted-foreground">Status</div><div className="mt-1 flex justify-center text-sm"><DeviceStatus status={d.status} /></div></div>
                  <div className="border-x border-slate-200/70 py-3 dark:border-white/10"><div className="text-xs text-muted-foreground">Rekaman</div><div className="mt-1 font-medium num">{all.length}</div></div>
                  <div className="py-3"><div className="text-xs text-muted-foreground">TB</div><div className="mt-1 font-medium text-danger num">{tb}</div></div>
                </div>
                <div className="flex items-center gap-2 p-5">
                  <Badge variant="secondary" className="gap-1"><ClockIcon />{fmt.ago(d.lastSeen)}</Badge>
                  <Button asChild size="sm" className="ml-auto"><Link href={`/devices/${d.id}`}>View Detail</Link></Button>
                </div>
              </div>
            </div>
          );
        })}
        {list.length === 0 && <div className="box intro-y col-span-12 p-10 text-center text-muted-foreground">Kosong</div>}
      </div>
    </AppLayout>
  );
}
