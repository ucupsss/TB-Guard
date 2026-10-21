'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { CameraIcon, ClockIcon, CubeIcon, DownloadIcon, EyeOpenIcon, MagnifyingGlassIcon, Pencil1Icon, SewingPinIcon, SpeakerLoudIcon, SpeakerModerateIcon } from '@radix-ui/react-icons';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DeviceStatus, ResultBadge } from '@/components/tb/common';
import { EditDetectionDialog } from '@/components/tb/EditDetectionDialog';
import { TablePager, usePaged } from '@/components/tb/TablePager';
import { useStore } from '@/lib/store';
import { fmt, downloadCSV } from '@/lib/format';

export default function DeviceDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '400';
  const { device, detections } = useStore();
  const dev = device(id);
  const [filter, setFilter] = React.useState('all');
  const [q, setQ] = React.useState('');
  const [editing, setEditing] = React.useState<string | null>(null);
  const all = React.useMemo(() => detections.filter((d) => d.deviceId === +id).sort((a, b) => b.time - a.time), [detections, id]);
  const rows = all.filter((r) => (filter === 'all' || (filter === 'pending' ? r.result === 'TB' && !r.reviewed : r.result === filter)) && (!q || [r.uuid, r.name, fmt.dateTime(r.time)].join(' ').toLowerCase().includes(q.toLowerCase())));
  const pg = usePaged(rows, 10);
  React.useEffect(() => pg.setPage(1), [filter, q]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!dev) return <AppLayout crumbs={[{ label: 'Devices', to: '/devices' }, { label: 'Tidak ditemukan' }]}><div className="box mt-8 p-10 text-center">Perangkat tidak ditemukan. <Link className="text-primary" href="/devices">Kembali</Link></div></AppLayout>;
  const tb = all.filter((r) => r.result === 'TB'), pend = tb.filter((r) => !r.reviewed);
  const hours = Array.from({ length: 24 }, (_, h) => ({ h: String(h).padStart(2, '0'), n: all.filter((r) => new Date(r.time).getHours() === h).length }));
  const peak = hours.reduce((a, b) => (b.n > a.n ? b : a));

  return (
    <AppLayout crumbs={[{ label: 'Devices', to: '/devices' }, { label: `Device Detail: ${dev.id}` }]}>
      <div className="intro-y mt-8 flex items-center"><h2 className="mr-auto text-lg font-medium">Device Detail: {dev.id}</h2></div>

      <Tabs defaultValue="data">
        {/* kepala profil */}
        <div className="intro-y box mt-5 px-5 pt-5">
          <div className="-mx-5 flex flex-col border-b border-slate-200/60 pb-5 dark:border-white/10 lg:flex-row">
            <div className="flex flex-1 items-center justify-center px-5 lg:justify-start">
              <div className="relative grid h-20 w-20 flex-none place-items-center rounded-full bg-primary/10 text-primary sm:h-24 sm:w-24 lg:h-28 lg:w-28 dark:text-blue-300">
                <CubeIcon className="h-10 w-10" />
                <span className={`absolute bottom-1 right-1 h-5 w-5 rounded-full border-4 border-card ${dev.status === 'active' ? 'bg-success' : dev.status === 'inactive' ? 'bg-pending' : 'bg-danger'}`} />
              </div>
              <div className="ml-5">
                <div className="w-24 truncate text-lg font-medium sm:w-40 sm:whitespace-normal">{dev.name}</div>
                <div className="text-muted-foreground">TB Guard Device · {dev.type}</div>
                <div className="mt-1"><DeviceStatus status={dev.status} /></div>
              </div>
            </div>
            <div className="mt-6 flex-1 border-t border-slate-200/60 px-5 pt-5 dark:border-white/10 lg:mt-0 lg:border-x lg:border-t-0 lg:pt-0">
              <div className="text-center font-medium lg:mt-3 lg:text-left">Detail Pemasangan</div>
              <div className="mt-4 flex flex-col items-center justify-center gap-3 lg:items-start">
                <div className="flex items-center gap-2 truncate"><SewingPinIcon className="h-4 w-4" />{dev.location} · {dev.zone}</div>
                <div className="flex items-center gap-2 truncate"><SpeakerModerateIcon className="h-4 w-4" />{dev.mics} mic · {dev.array}</div>
                <div className="flex items-center gap-2 truncate"><CameraIcon className="h-4 w-4" />{dev.camera}</div>
              </div>
            </div>
            <div className="mt-6 flex flex-1 items-center justify-center border-t border-slate-200/60 px-5 pt-5 dark:border-white/10 lg:mt-0 lg:border-0 lg:pt-0">
              {[['Rekaman', all.length, ''], ['Terindikasi TB', tb.length, 'text-danger'], ['Belum ditinjau', pend.length, pend.length ? 'text-pending' : '']].map(([l, v, c]) => (
                <div key={l as string} className="w-24 rounded-md py-3 text-center sm:w-28">
                  <div className={`text-xl font-medium num ${c}`}>{v}</div>
                  <div className="text-muted-foreground">{l}</div>
                </div>
              ))}
            </div>
          </div>
          <TabsList className="h-auto justify-start gap-0 rounded-none bg-transparent p-0">
            {[['data', 'Device Data'], ['detail', 'Device Detail']].map(([v, l]) => (
              <TabsTrigger key={v} value={v} className="rounded-none border-b-2 border-transparent px-4 py-4 text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-primary data-[state=active]:shadow-none dark:data-[state=active]:text-blue-300">{l}</TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* tab data */}
        <TabsContent value="data" className="mt-5">
          <div className="intro-y flex flex-wrap items-center gap-3">
            <ToggleGroup type="single" value={filter} onValueChange={(v) => setFilter(v || 'all')} className="box p-1">
              <ToggleGroupItem value="all" size="sm">Semua</ToggleGroupItem>
              <ToggleGroupItem value="TB" size="sm">Terindikasi TB</ToggleGroupItem>
              <ToggleGroupItem value="NEG" size="sm">Negatif TB</ToggleGroupItem>
              <ToggleGroupItem value="pending" size="sm">Belum ditinjau</ToggleGroupItem>
            </ToggleGroup>
            <div className="relative w-full sm:ml-auto sm:w-56">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari UUID, nama, tanggal" className="box border-0 pr-9" aria-label="Cari data" />
              <MagnifyingGlassIcon className="absolute inset-y-0 right-0 my-auto mr-3 h-4 w-4 text-muted-foreground" />
            </div>
            <Button variant="outline" className="box border-0" onClick={() => downloadCSV(`tbguard-${dev.id}-data.csv`, [['uuid', 'waktu', 'nama', 'gender', 'umur', 'type', 'hasil', 'confidence', 'doa_azimuth']].concat(all.map((r) => [r.uuid, new Date(r.time).toISOString(), r.name, r.gender, String(r.age), r.type, r.result, String(r.confidence), String(r.doa.azimuth)])))}><DownloadIcon />Export CSV</Button>
          </div>
          <div className="intro-y overflow-auto">
            <table className="table-report w-full min-w-[860px]">
              <thead><tr><th>No</th><th>Time</th><th>UUID</th><th>Nama</th><th>Gender</th><th>Umur</th><th>Type</th><th>Jenis Batuk</th><th className="!text-center">Aksi</th></tr></thead>
              <tbody>
                {pg.slice.map((r, i) => (
                  <tr key={r.uuid}>
                    <td className="px-5 py-3 num">{(pg.page - 1) * pg.size + i + 1}</td>
                    <td className="px-5 py-3 whitespace-nowrap">{fmt.dateShort(r.time)}<div className="text-xs text-muted-foreground">{fmt.time(r.time)} WIB</div></td>
                    <td className="px-5 py-3 font-medium">{r.uuid}</td>
                    <td className="px-5 py-3">{r.name || <span className="text-muted-foreground">–</span>}</td>
                    <td className="px-5 py-3">{r.gender || <span className="text-muted-foreground">–</span>}</td>
                    <td className="px-5 py-3 num">{r.age || <span className="text-muted-foreground">–</span>}</td>
                    <td className="px-5 py-3">{r.type}</td>
                    <td className="px-5 py-3"><ResultBadge result={r.result} />{r.result === 'TB' && !r.reviewed && <div className="mt-1 text-xs text-pending">● belum ditinjau</div>}</td>
                    <td className="relative w-64 px-5 py-3 before:absolute before:inset-y-0 before:left-0 before:my-auto before:block before:h-8 before:w-px before:bg-slate-200 dark:before:bg-white/10">
                      <div className="flex items-center justify-center gap-4">
                        <Link href={`/detections/${r.uuid}`} className="flex items-center gap-1 hover:text-primary"><EyeOpenIcon className="h-4 w-4" />Lihat Detail</Link>
                        <Link href={`/detections/${r.uuid}#audio`} className="flex items-center gap-1 text-primary dark:text-blue-300"><SpeakerLoudIcon className="h-4 w-4" />Cek Suara</Link>
                        <button onClick={() => setEditing(r.uuid)} className="flex items-center gap-1 text-pending"><Pencil1Icon className="h-4 w-4" />Edit</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!pg.slice.length && <tr><td colSpan={9} className="px-5 py-10 text-center text-muted-foreground">Tidak ada rekaman yang cocok.</td></tr>}
              </tbody>
            </table>
          </div>
          <TablePager page={pg.page} pages={pg.pages} onPage={pg.setPage} size={pg.size} onSize={pg.setSize} />
        </TabsContent>

        {/* tab detail */}
        <TabsContent value="detail" className="mt-5">
          <div className="grid grid-cols-12 gap-6">
            <div className="intro-y box col-span-12 p-5 lg:col-span-7">
              <div className="mb-5 flex items-center border-b border-slate-200/60 pb-5 font-medium dark:border-white/10">Informasi Perangkat</div>
              <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                {[['Device ID', dev.id], ['Nama Device', dev.name], ['Status', <DeviceStatus key="s" status={dev.status} />], ['Lokasi', dev.location], ['Zona', dev.zone], ['Kota', dev.city],
                  ['Koordinat', `${dev.lat}, ${dev.lng}`], ['Dipasang', fmt.date(new Date(dev.installed).getTime())], ['Terakhir aktif', fmt.ago(dev.lastSeen)],
                  ['Microphone array', `${dev.mics} mic · ${dev.array}`], ['Kamera', dev.camera], ['Firmware', dev.fw], ['Sample rate', '16 kHz'], ['Segmentasi', '1 detik'], ['Fitur', '39 MFCC']].map(([k, v], i) => (
                  <div key={i}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 font-medium">{v}</dd></div>
                ))}
              </dl>
            </div>
            <div className="intro-y box col-span-12 p-5 lg:col-span-5">
              <div className="mb-5 flex items-center border-b border-slate-200/60 pb-5 dark:border-white/10"><span className="font-medium">Pola Waktu Deteksi</span><span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground"><ClockIcon className="h-3.5 w-3.5" />jam ramai {peak.h}.00</span></div>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hours} margin={{ left: -24, right: 4 }}>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis dataKey="h" tickLine={false} axisLine={false} fontSize={11} interval={3} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
                    <RTooltip cursor={{ fill: 'rgba(28,63,170,.06)' }} contentStyle={{ fontSize: 12, borderRadius: 6 }} formatter={(v) => [v as number, 'rekaman']} labelFormatter={(l) => `${l}.00`} />
                    <Bar dataKey="n" radius={[3, 3, 0, 0]}>{hours.map((h) => <Cell key={h.h} fill={h.h === peak.h ? '#1C3FAA' : '#93b4f5'} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-200/60 pt-4 dark:border-white/10">
                <div><dt className="text-xs text-muted-foreground">Rata-rata confidence</dt><dd className="mt-1 font-medium num">{all.length ? (all.reduce((s, r) => s + r.confidence, 0) / all.length).toFixed(3) : '–'}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Individu terlacak</dt><dd className="mt-1 font-medium num">{all.filter((r) => r.person.tracked).length} dari {all.length}</dd></div>
              </dl>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <EditDetectionDialog uuid={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />
    </AppLayout>
  );
}
