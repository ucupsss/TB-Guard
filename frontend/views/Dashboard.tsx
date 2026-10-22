'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip } from 'recharts';
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon, CopyIcon, Cross2Icon, DotsVerticalIcon, EyeOpenIcon, FileTextIcon, Pencil1Icon, PlusIcon, SewingPinIcon, SpeakerLoudIcon, TableIcon } from '@radix-ui/react-icons';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SectionHeader, DetectionThumbs, PersonAvatar, DeltaPill } from '@/components/tb/common';
import { EditDetectionDialog } from '@/components/tb/EditDetectionDialog';
import { TablePager, usePaged } from '@/components/tb/TablePager';
import { DeviceMap } from '@/components/tb/DeviceMap';
import { NurseIllustration, PhoneIllustration } from '@/components/tb/Illustrations';
import { useStore, NOW, STAGES } from '@/lib/store';
import { fmt, downloadCSV } from '@/lib/format';
import { cn } from '@/lib/utils';

const DAY = 86400000;
const pctChange = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : 0);

export default function Dashboard() {
  const { devices, detections, patients, datasets, device } = useStore();
  const router = useRouter();
  const [period, setPeriod] = React.useState('7');
  const [notice, setNotice] = React.useState(true);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [mix, setMix] = React.useState('hasil');
  const [city, setCity] = React.useState('');
  const [note, setNote] = React.useState(0);

  const days = +period;
  const cur = detections.filter((d) => NOW.getTime() - d.time < days * DAY);
  const prev = detections.filter((d) => NOW.getTime() - d.time >= days * DAY && NOW.getTime() - d.time < 2 * days * DAY);
  const tbCur = cur.filter((d) => d.result === 'TB').length, tbPrev = prev.filter((d) => d.result === 'TB').length;
  const pending = detections.filter((d) => d.result === 'TB' && !d.reviewed).sort((a, b) => b.time - a.time);
  const active = devices.filter((d) => d.status === 'active');
  const offlineMatch = datasets.offline.filter((r) => r.label === r.pred).length / datasets.offline.length;

  // aktivitas hari ini per jam
  const startToday = new Date(NOW); startToday.setHours(0, 0, 0, 0);
  const today = detections.filter((d) => d.time >= startToday.getTime());
  const hours = Array.from({ length: 24 }, (_, h) => ({ h: String(h).padStart(2, '0') + '.00', n: detections.filter((d) => NOW.getTime() - d.time < 14 * DAY && new Date(d.time).getHours() === h).length }));
  const perDevice = devices.map((d) => ({ d, n: cur.filter((x) => x.deviceId === d.id).length })).sort((a, b) => b.n - a.n);

  // komposisi
  const neg = cur.filter((d) => d.result === 'NEG' && d.type !== '-').length, notCough = cur.filter((d) => d.type === '-').length;
  const ageBuckets = [
    { name: '17 - 30 tahun', value: patients.filter((p) => +p.age <= 30).length, color: '#F78B00' },
    { name: '31 - 50 tahun', value: patients.filter((p) => +p.age > 30 && +p.age <= 50).length, color: '#1C3FAA' },
    { name: '> 50 tahun', value: patients.filter((p) => +p.age > 50).length, color: '#FBC500' },
  ];
  const resultMix = [
    { name: 'Negatif TB', value: neg, color: '#1C3FAA' },
    { name: 'Terindikasi TB', value: tbCur, color: '#F78B00' },
    { name: 'Bukan batuk', value: notCough, color: '#FBC500' },
  ];
  const pie = mix === 'hasil' ? resultMix : ageBuckets;
  const pieTotal = pie.reduce((a, b) => a + b.value, 0);

  // tabel deteksi terbaru
  const recent = [...detections].sort((a, b) => b.time - a.time);
  const pg = usePaged(recent, 5);

  // jadwal kontrol
  const visits = patients.filter((p) => p.nextVisit).sort((a, b) => a.nextVisit! - b.nextVisit!);
  const visitDays = visits.map((p) => new Date(p.nextVisit!));
  const [month, setMonth] = React.useState(new Date(NOW));

  // aktivitas terbaru: gabungan event pasien & deteksi TB
  const activity = [
    ...patients.flatMap((p) => p.events.map((e) => ({ t: e.t, who: p.name, text: e.text, kind: 'pasien' as const }))),
    ...detections.filter((d) => d.result === 'TB').map((d) => ({ t: d.time, who: device(d.deviceId)?.name || '', text: `Batuk terindikasi TB (conf. ${d.confidence.toFixed(2)})`, kind: 'deteksi' as const, uuid: d.uuid })),
  ].sort((a, b) => b.t - a.t).slice(0, 5);

  const notes = [
    ...devices.filter((d) => d.status !== 'active').map((d) => ({ title: `${d.name} ${d.status === 'broken' ? 'rusak' : 'tidak aktif'}`, when: d.lastSeen, body: `${d.name} di ${d.location} (${d.zone}) terakhir mengirim data ${fmt.ago(d.lastSeen)}. ${d.status === 'broken' ? 'Perlu dicek oleh petugas IT sebelum dipasang kembali.' : 'Pastikan perangkat menyala dan terhubung ke jaringan.'}`, to: `/devices/${d.id}` })),
    { title: `${pending.length} batuk terindikasi TB menunggu tinjauan`, when: pending[0]?.time ?? NOW.getTime(), body: `Peringatan tertua masuk ${pending.length ? fmt.ago(pending[pending.length - 1].time) : '-'}. Dokter perlu meninjau rekaman suara, arah datang suara, dan hasil pelacakan individu sebelum pasien dihubungi.`, to: pending[0] ? `/detections/${pending[pending.length - 1].uuid}` : '/' },
  ];
  const n = notes[note % notes.length];

  const exportCSV = () => downloadCSV('tbguard-deteksi.csv', [['uuid', 'waktu', 'perangkat', 'hasil', 'confidence', 'azimuth']].concat(recent.map((d) => [d.uuid, new Date(d.time).toISOString(), device(d.deviceId)?.name || '', d.result, String(d.confidence), String(d.doa.azimuth)])));

  return (
    <AppLayout crumbs={[{ label: 'Dashboard' }]}>
      {notice && pending.length > 0 && (
        <div className="intro-y mt-5 flex items-center rounded-md bg-primary px-4 py-3 text-white shadow-box">
          <span className="flex-1">{pending.length} batuk TB belum ditinjau · <Link href={`/detections/${pending[0].uuid}`} className="font-medium underline underline-offset-2">Tinjau</Link></span>
          <button onClick={() => setNotice(false)} className="ml-3 rounded p-1 hover:bg-white/10" aria-label="Tutup pemberitahuan"><Cross2Icon className="h-4 w-4" /></button>
        </div>
      )}

      <div className="mt-6 grid grid-cols-12 gap-6">
        {/* ===== Ringkasan (General Report) ===== */}
        <div className="col-span-12 flex flex-col lg:col-span-8 xl:col-span-6">
          <SectionHeader title="Ringkasan Skrining">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="box h-9 w-36 border-0" aria-label="Periode"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="7">7 hari</SelectItem><SelectItem value="14">14 hari</SelectItem><SelectItem value="30">30 hari</SelectItem></SelectContent>
            </Select>
          </SectionHeader>
          <div className="box intro-y flex flex-1 flex-col md:flex-row">
            <div className="flex-1 px-8 py-12">
              <SpeakerLoudIcon className="h-10 w-10 text-pending" />
              <div className="mt-6 flex items-end gap-1 text-3xl font-medium xl:text-4xl"><span className="num">{cur.length}</span><span className="mb-1 text-base font-normal text-muted-foreground">suara</span></div>
              <div className="mt-4 flex items-center gap-2"><DeltaPill value={pctChange(cur.length, prev.length)} goodWhenUp /><span className="text-xs text-muted-foreground">vs {days} hari sebelumnya</span></div>
              <div className="mt-4 text-muted-foreground" title={`Dari ${active.length} perangkat aktif, diklasifikasi model LSTM`}>{active.length} perangkat aktif</div>
              <button onClick={exportCSV} className="relative mt-12 flex h-10 items-center justify-start rounded-full border border-dashed border-slate-300 pl-5 pr-14 text-sm font-medium transition-all cursor-pointer hover:border-primary hover:text-primary hover:bg-primary/5 active:scale-95 dark:border-white/20">
                Download Laporan
                <span className="absolute inset-y-0 right-0 my-auto mr-1 grid h-8 w-8 place-items-center rounded-full bg-primary text-white"><ArrowRightIcon className="h-4 w-4" /></span>
              </button>
            </div>
            <div className="flex flex-1 flex-col justify-center border-t border-dashed border-slate-200 px-8 py-12 md:border-l md:border-t-0 dark:border-white/10">
              {[
                ['Terindikasi TB', String(tbCur), pctChange(tbCur, tbPrev), false],
                ['Belum ditinjau', String(pending.length), null, false],
                ['Pasien dipantau', String(patients.filter((p) => p.stage < 4).length), null, true],
                ['Perangkat aktif', `${active.length} / ${devices.length}`, null, true],
                ['Prediksi sesuai label', fmt.pct(offlineMatch), null, true],
              ].map(([label, val, delta, good], i) => (
                <div key={i} className={cn(i > 0 && 'mt-5')}>
                  <div className="text-xs uppercase text-muted-foreground">{label as string}</div>
                  <div className="mt-1.5 flex items-center"><span className="text-base num">{val as string}</span>
                    {delta !== null && <span className={cn('ml-2 flex items-center text-xs font-medium', (delta as number) > 0 ? 'text-danger' : 'text-success')}>{fmt.dec(Math.abs(delta as number), 0)}% {(delta as number) > 0 ? '↑' : '↓'}</span>}
                    {delta === null && !good && pending.length > 0 && <span className="ml-2 text-xs text-danger">perlu tindakan</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== Aktivitas perangkat (Visitors) ===== */}
        <div className="col-span-12 flex flex-col sm:col-span-6 lg:col-span-4 xl:col-span-3">
          <SectionHeader title="Aktivitas Perangkat"><Link href="/devices" className="truncate text-sm text-primary dark:text-blue-300">Lihat di Peta</Link></SectionHeader>
          <div className="box intro-y flex flex-1 flex-col p-5">
            <div className="flex items-center">
              <div className="text-muted-foreground">Rekaman masuk hari ini</div>
              <DropdownMenu>
                <DropdownMenuTrigger className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-accent" aria-label="Opsi"><DotsVerticalIcon className="h-4 w-4" /></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => router.push('/devices')}>Daftar perangkat</DropdownMenuItem>
                  <DropdownMenuItem onSelect={exportCSV}>Export CSV</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="mt-1 text-2xl font-medium num">{today.length}</div>
            <div className="mt-4 flex items-center border-b border-slate-200 pb-2 dark:border-white/10">
              <div className="text-muted-foreground">Per jam · 14 hari</div>
              <div className="ml-auto text-xs text-success">jam ramai {hours.reduce((a, b) => (b.n > a.n ? b : a)).h}</div>
            </div>
            <div className="mt-2 h-[72px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hours} barCategoryGap={1}>
                  <RTooltip cursor={{ fill: 'rgba(28,63,170,.06)' }} contentStyle={{ fontSize: 12, borderRadius: 6 }} formatter={(v) => [v as number, 'rekaman']} labelFormatter={(_, p) => (p[0]?.payload.h ?? '')} />
                  <Bar dataKey="n" radius={[2, 2, 0, 0]}>{hours.map((h, i) => <Cell key={i} fill={i % 2 ? '#1C3FAA' : '#93b4f5'} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex items-center justify-between border-b border-slate-200 pb-2 text-muted-foreground dark:border-white/10"><span>Perangkat teraktif</span><span>Rekaman</span></div>
            {perDevice.map(({ d, n }) => (
              <Link key={d.id} href={`/devices/${d.id}`} className="mt-1.5 flex items-center justify-between hover:text-primary"><span className="truncate">{d.name} · {d.zone.split(' – ')[0]}</span><span className="num">{n}</span></Link>
            ))}
            <div className="min-h-4 flex-1" />
            <Button asChild variant="outline" className="w-full border-dashed shadow-none"><Link href="/devices">Laporan Real-Time</Link></Button>
          </div>
        </div>

        {/* ===== Komposisi (Users By Age) ===== */}
        <div className="col-span-12 flex flex-col sm:col-span-6 lg:col-span-4 xl:col-span-3">
          <SectionHeader title="Komposisi"><Link href="/patients" className="truncate text-sm text-primary dark:text-blue-300">Show More</Link></SectionHeader>
          <div className="box intro-y flex flex-1 flex-col p-5">
            <Tabs value={mix} onValueChange={setMix} className="flex justify-center">
              <TabsList className="mx-auto w-4/5 bg-secondary/70">
                <TabsTrigger value="hasil" className="flex-1">Hasil</TabsTrigger>
                <TabsTrigger value="usia" className="flex-1">Usia Pasien</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative mt-6 h-[208px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius="78%" outerRadius="100%" startAngle={90} endAngle={-270} paddingAngle={2} stroke="none">
                    {pie.map((p, i) => <Cell key={i} fill={p.color} />)}
                  </Pie>
                  <RTooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-xl font-medium num">{pieTotal}</div>
                <div className="mt-0.5 text-muted-foreground">{mix === 'hasil' ? `suara, ${days} hari` : 'pasien'}</div>
              </div>
            </div>
            <div className="min-h-6 flex-1" />
            <div className="mx-auto w-52 sm:w-auto">
              {pie.map((p) => (
                <div key={p.name} className="mt-3 flex items-center first:mt-0">
                  <span className="mr-3 h-2 w-2 rounded-full" style={{ background: p.color }} />
                  <span className="truncate">{p.name}</span>
                  <span className="ml-auto font-medium num">{pieTotal ? fmt.pct(p.value / pieTotal, 0) : '0%'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== Peta perangkat (Official Store) ===== */}
        <div className="col-span-12 xl:col-span-8">
          <SectionHeader title="Peta Perangkat">
            <div className="relative hidden sm:block">
              <SewingPinIcon className="absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-muted-foreground" />
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Kota" className="box h-9 w-56 border-0 pl-9" aria-label="Filter berdasarkan kota" />
            </div>
          </SectionHeader>
          <div className="box intro-y p-5">
            <div title="Klik penanda untuk detail · angka = batuk terindikasi TB">{devices.length} perangkat · Surabaya</div>
            <DeviceMap devices={devices.filter((d) => !city || d.city.toLowerCase().includes(city.toLowerCase()) || d.location.toLowerCase().includes(city.toLowerCase()))} detections={detections} className="z-0 mt-5 h-[310px] overflow-hidden rounded-md bg-slate-200" />
          </div>
        </div>

        {/* ===== Peringatan terbaru (Weekly Best Sellers) ===== */}
        <div className="col-span-12 md:col-span-6 xl:col-span-4">
          <SectionHeader title="Peringatan TB Terbaru" />
          <div>
            {pending.slice(0, 4).map((d) => (
              <Link key={d.uuid} href={`/detections/${d.uuid}`} className="intro-y box mb-3 flex items-center px-4 py-4 transition hover:shadow-box-lg">
                <span className="grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-md bg-danger/10 text-danger"><SpeakerLoudIcon className="h-5 w-5" /></span>
                <span className="ml-4 mr-auto min-w-0">
                  <span className="block truncate font-medium">{device(d.deviceId)?.name} · {device(d.deviceId)?.zone.split(' – ')[0]}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{fmt.date(d.time)}</span>
                </span>
                <Badge variant="destructive" className="num">TB {d.confidence.toFixed(2)}</Badge>
              </Link>
            ))}
            <Button asChild variant="outline" className="intro-y w-full border-dashed bg-transparent py-5 shadow-none"><Link href={pending[0] ? `/devices/${pending[0].deviceId}` : '/devices'}>Lihat Semua ({pending.length})</Link></Button>
          </div>
        </div>

        {/* ===== Dua kartu promo ===== */}
        <div className="col-span-12 grid grid-cols-12 gap-6">
          <div className="intro-y relative col-span-12 overflow-hidden rounded-md bg-primary p-6 text-white shadow-box sm:col-span-6 sm:p-8">
            <div className="relative z-10 w-full sm:w-3/5">
              <div className="text-lg font-medium leading-snug sm:text-xl" title="Pantau dari skrining lanjut, konfirmasi lab, sampai sembuh.">Lacak pasien TB</div>
              <Button variant="white" className="mt-6 w-32 sm:mt-10" onClick={() => router.push('/patients')}>Mulai</Button>
            </div>
            <NurseIllustration className="absolute bottom-0 right-0 hidden h-[95%] sm:block" />
          </div>
          <div className="intro-y box relative col-span-12 overflow-hidden p-6 sm:col-span-6 sm:p-8">
            <div className="relative z-10 sm:w-3/5">
              <div className="text-lg font-medium leading-snug text-primary dark:text-blue-300 sm:text-xl" title="Masyarakat merekam batuk & isi gejala sendiri. Hasil masuk ke Data Batuk Web Form."><span className="font-bold">SKRINING MANDIRI</span></div>
              <div className="relative mt-6 w-56 sm:mt-10">
                <Input readOnly value="https://tbguard.id/batuk" aria-label="Tautan formulir" className="pr-10" />
                <button className="absolute inset-y-0 right-0 my-auto mr-2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Salin tautan"
                  onClick={() => { navigator.clipboard?.writeText('https://tbguard.id/batuk').catch(() => {}); toast.success('Tautan formulir disalin'); }}><CopyIcon className="h-4 w-4" /></button>
              </div>
            </div>
            <PhoneIllustration className="absolute bottom-2 right-4 hidden h-[85%] sm:block" />
          </div>
        </div>

        {/* ===== Deteksi terbaru (Weekly Top Products) ===== */}
        <div className="col-span-12">
          <div className="intro-y mb-1 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <h2 className="section-title">Deteksi Terbaru</h2>
            <div className="flex gap-2 sm:ml-auto">
              <Button variant="outline" className="box border-0" onClick={exportCSV}><TableIcon />Export ke Excel</Button>
              <Button variant="outline" className="box border-0" onClick={() => window.print()}><FileTextIcon />Export ke PDF</Button>
            </div>
          </div>
          <div className="intro-y overflow-auto">
            <table className="table-report w-full min-w-[720px] -mt-2">
              <thead><tr><th>Gambar</th><th>Perangkat</th><th className="!text-center">Confidence</th><th className="!text-center">Status</th><th className="!text-center">Aksi</th></tr></thead>
              <tbody>
                {pg.slice.map((d) => (
                  <tr key={d.uuid}>
                    <td className="w-40 px-5 py-3"><DetectionThumbs d={d} /></td>
                    <td className="px-5 py-3">
                      <Link href={`/detections/${d.uuid}`} className="font-medium hover:text-primary">{device(d.deviceId)?.name}</Link>
                      <div className="mt-0.5 text-xs text-muted-foreground">{device(d.deviceId)?.zone.split(' – ')[0]} · {fmt.dateTime(d.time)}</div>
                    </td>
                    <td className="px-5 py-3 text-center num">{d.confidence.toFixed(4)}</td>
                    <td className="w-48 px-5 py-3">
                      <div className={cn('flex items-center justify-center gap-1.5', d.result === 'TB' ? 'text-danger' : 'text-success')}>
                        <span className={cn('h-2 w-2 rounded-full', d.result === 'TB' ? 'bg-danger' : 'bg-success')} />{d.result === 'TB' ? 'Terindikasi TB' : 'Negatif TB'}
                      </div>
                    </td>
                    <td className="relative w-56 px-5 py-3 before:absolute before:inset-y-0 before:left-0 before:my-auto before:block before:h-8 before:w-px before:bg-slate-200 dark:before:bg-white/10">
                      <div className="flex items-center justify-center gap-4">
                        <Link href={`/detections/${d.uuid}`} className="flex items-center gap-1 hover:text-primary"><EyeOpenIcon className="h-4 w-4" />Lihat</Link>
                        <button onClick={() => setEditing(d.uuid)} className="flex items-center gap-1 text-pending hover:opacity-80"><Pencil1Icon className="h-4 w-4" />Edit</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePager page={pg.page} pages={pg.pages} onPage={pg.setPage} size={pg.size} onSize={pg.setSize} />
        </div>

        {/* ===== Catatan penting (Important Notes) ===== */}
        <div className="col-span-12">
          <SectionHeader title="Catatan Penting">
            <Button variant="outline" size="icon" className="box h-8 w-8 border-0" onClick={() => setNote((x) => (x - 1 + notes.length) % notes.length)} aria-label="Catatan sebelumnya"><ChevronLeftIcon /></Button>
            <Button variant="outline" size="icon" className="box h-8 w-8 border-0" onClick={() => setNote((x) => (x + 1) % notes.length)} aria-label="Catatan berikutnya"><ChevronRightIcon /></Button>
          </SectionHeader>
          <div className="box intro-y p-5" aria-live="polite">
            <div className="text-base font-medium" title={n.body}>{n.title}</div>
            <div className="mt-1 text-muted-foreground">{fmt.ago(n.when)}</div>
            <div className="mt-5 flex font-medium">
              <Button variant="secondary" size="sm" onClick={() => router.push(n.to)}>Lihat Detail</Button>
              <Button variant="outline" size="sm" className="ml-auto" onClick={() => setNote((x) => (x + 1) % notes.length)}>Dismiss</Button>
            </div>
          </div>
        </div>

        {/* ===== Jadwal kontrol (Schedules) ===== */}
        <div className="col-span-12 md:col-span-6 xl:col-span-4">
          <SectionHeader title="Jadwal Kontrol"><Link href="/patients" className="flex items-center gap-1 truncate text-sm text-primary dark:text-blue-300"><PlusIcon className="h-4 w-4" />Tambah Jadwal</Link></SectionHeader>
          <div className="box intro-y p-5">
            <Calendar mode="single" month={month} onMonthChange={setMonth} selected={new Date(NOW)} modifiers={{ visit: visitDays }}
              modifiersClassNames={{ visit: 'bg-success/20 text-[#4d6c0b] font-medium dark:text-success' }} className="w-full" />
            <div className="mt-5 border-t border-slate-200 pt-5 dark:border-white/10">
              {visits.slice(0, 4).map((p, i) => (
                <div key={p.id} className="mt-3 flex items-center first:mt-0">
                  <span className={cn('mr-3 h-2 w-2 rounded-full', ['bg-pending', 'bg-primary', 'bg-warning', 'bg-success'][i % 4])} />
                  <span className="truncate">{p.name} · {STAGES[p.stage]}</span>
                  <span className="ml-auto whitespace-nowrap font-medium">{fmt.dayShort(p.nextVisit!)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== Aktivitas terbaru (Recent Activities) ===== */}
        <div className="col-span-12 md:col-span-6 xl:col-span-4">
          <SectionHeader title="Aktivitas Terbaru"><Link href="/patients" className="truncate text-sm text-primary dark:text-blue-300">Show More</Link></SectionHeader>
          <div className="relative mt-5 before:absolute before:ml-5 before:mt-5 before:block before:h-[85%] before:w-px before:bg-slate-200 dark:before:bg-white/10">
            {activity.map((a, i) => (
              <React.Fragment key={i}>
                {i === 3 && <div className="intro-x my-4 text-center text-xs text-muted-foreground">{fmt.dayShort(a.t)}</div>}
                <div className="intro-x relative mb-3 flex items-center">
                  <div className="before:absolute before:ml-5 before:mt-5 before:block before:h-px before:w-20 before:bg-slate-200 dark:before:bg-white/10">
                    <PersonAvatar name={a.who} className="relative ring-4 ring-page" />
                  </div>
                  <div className="box ml-4 flex-1 px-5 py-3">
                    <div className="flex items-center"><span className="font-medium">{a.who}</span><span className="ml-auto text-xs text-muted-foreground">{fmt.time(a.t)}</span></div>
                    <div className="mt-1 text-muted-foreground">{a.kind === 'deteksi' ? <Link href={`/detections/${(a as { uuid: string }).uuid}`} className="text-primary dark:text-blue-300">{a.text}</Link> : a.text}</div>
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ===== Kepatuhan pasien (Transactions) ===== */}
        <div className="col-span-12 md:col-span-6 xl:col-span-4">
          <SectionHeader title="Kepatuhan Pasien" />
          <div className="mt-5">
            {patients.filter((p) => p.adherence != null).slice(0, 5).map((p) => (
              <Link key={p.id} href={`/patients?open=${p.id}`} className="intro-y box mb-3 flex items-center px-5 py-3 transition hover:shadow-box-lg">
                <PersonAvatar name={p.name} />
                <span className="ml-4 mr-auto min-w-0"><span className="block truncate font-medium">{p.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{p.nextVisit ? 'Kontrol ' + fmt.date(p.nextVisit) : 'Pengobatan selesai'}</span></span>
                <span className={cn('font-medium num', p.adherence! < 85 ? 'text-danger' : 'text-success')}>{p.adherence}%</span>
              </Link>
            ))}
            <Button asChild variant="outline" className="intro-y w-full border-dashed bg-transparent py-5 shadow-none"><Link href="/patients">Lihat Semua</Link></Button>
          </div>
        </div>
      </div>

      <EditDetectionDialog uuid={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />
    </AppLayout>
  );
}
