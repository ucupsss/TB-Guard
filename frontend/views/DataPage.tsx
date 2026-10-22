'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { ActivityLogIcon, CheckCircledIcon, ClockIcon, DownloadIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, MixIcon, PersonIcon, SpeakerLoudIcon } from '@radix-ui/react-icons';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ReportBox } from '@/components/tb/ReportBox';
import { ResultBadge } from '@/components/tb/common';
import { TablePager, usePaged } from '@/components/tb/TablePager';
import { useStore } from '@/lib/store';
import { fmt, downloadCSV } from '@/lib/format';
import type { WebformRow, OfflineRow, PrimerRow } from '@/lib/types';

type Src = 'webform' | 'offline' | 'primer';
const TITLES: Record<Src, [string, string]> = {
  webform: ['Data Batuk Web Form', 'Rekaman batuk yang dikirim masyarakat secara mandiri lewat formulir web, lengkap dengan kuesioner gejala.'],
  offline: ['Data Batuk Naracoba Offline', 'Rekaman yang dikumpulkan tim secara langsung di faskes & posyandu, berlabel untuk pelatihan dan evaluasi model.'],
  primer: ['Data Batuk TB Primer', 'Data primer pasien TB terkonfirmasi laboratorium dari mitra RSKI Universitas Airlangga.'],
};
const g = (x: string) => (x === 'L' ? 'Laki-laki' : 'Perempuan');
const td = 'px-5 py-3';

export default function DataPage() {
  const params = useParams<{ src: string }>();
  const src = (['webform', 'offline', 'primer'].includes(params?.src ?? '') ? params!.src : 'webform') as Src;
  return <DataView key={src} src={src} />;
}

function DataView({ src }: { src: Src }) {
  const { datasets } = useStore();
  const [f, setF] = React.useState('all');
  const [q, setQ] = React.useState('');
  const [title, desc] = TITLES[src];

  const web = datasets.webform, off = datasets.offline, pri = datasets.primer;
  const rows: (WebformRow | OfflineRow | PrimerRow)[] = (src === 'webform' ? web.filter((r) => (f === 'all' || r.result === f) && (!q || [r.id, r.name, r.city, r.symptoms.join(' ')].join(' ').toLowerCase().includes(q.toLowerCase())))
    : src === 'offline' ? off.filter((r) => (f === 'all' || (f === 'miss' ? r.label !== r.pred : r.label === f)) && (!q || [r.id, r.site, r.collector, r.mic].join(' ').toLowerCase().includes(q.toLowerCase())))
      : pri.filter((r) => (f === 'all' || r.lab === f) && (!q || [r.id, r.method, r.phase].join(' ').toLowerCase().includes(q.toLowerCase()))));
  const pg = usePaged(rows, 10);

  const filters: [string, string][] = src === 'webform' ? [['all', 'Semua'], ['TB', 'Terindikasi TB'], ['NEG', 'Negatif TB']]
    : src === 'offline' ? [['all', 'Semua'], ['TB', 'Label TB'], ['NEG', 'Label non-TB'], ['miss', 'Prediksi meleset']] : [['all', 'Semua'], ['Positif', 'Lab positif'], ['Negatif', 'Lab negatif']];

  const exportCSV = () => {
    if (src === 'webform') downloadCSV('tbguard-webform.csv', [['id', 'waktu', 'nama', 'gender', 'umur', 'kota', 'gejala', 'lama_minggu', 'rekaman', 'hasil', 'confidence'], ...web.map((r) => [r.id, new Date(r.time).toISOString(), r.name, r.gender, r.age, r.city, r.symptoms.join('; '), r.weeks, r.recordings, r.result, r.confidence])]);
    else if (src === 'offline') downloadCSV('tbguard-offline.csv', [['kode', 'tanggal', 'lokasi', 'gender', 'umur', 'perangkat', 'rekaman', 'label', 'prediksi', 'petugas'], ...off.map((r) => [r.id, new Date(r.time).toISOString().slice(0, 10), r.site, r.gender, r.age, r.mic, r.recordings, r.label, r.pred, r.collector])]);
    else downloadCSV('tbguard-primer.csv', [['kode', 'tanggal', 'gender', 'umur', 'pemeriksaan', 'hasil_lab', 'fase', 'rekaman', 'prediksi', 'confidence'], ...pri.map((r) => [r.id, new Date(r.time).toISOString().slice(0, 10), r.gender, r.age, r.method, r.lab, r.phase, r.recordings, r.pred, r.confidence])]);
  };

  const boxes = src === 'webform' ? [
    { icon: PersonIcon, color: 'text-primary', value: web.length, label: 'Responden' },
    { icon: SpeakerLoudIcon, color: 'text-pending', value: web.reduce((s, r) => s + r.recordings, 0), label: 'Rekaman' },
    { icon: ExclamationTriangleIcon, color: 'text-danger', value: web.filter((r) => r.result === 'TB').length, label: 'Terindikasi TB', pill: fmt.pct(web.filter((r) => r.result === 'TB').length / web.length, 0), pv: 'destructive' as const },
    { icon: ClockIcon, color: 'text-warning', value: web.filter((r) => r.weeks >= 2).length, label: 'Batuk ≥ 2 minggu' },
  ] : src === 'offline' ? [
    { icon: PersonIcon, color: 'text-primary', value: off.length, label: 'Naracoba' },
    { icon: SpeakerLoudIcon, color: 'text-pending', value: off.reduce((s, r) => s + r.recordings, 0), label: 'Rekaman' },
    { icon: ExclamationTriangleIcon, color: 'text-danger', value: off.filter((r) => r.label === 'TB').length, label: 'Label TB' },
    { icon: CheckCircledIcon, color: 'text-success', value: fmt.pct(off.filter((r) => r.label === r.pred).length / off.length), label: 'Prediksi sesuai label' },
  ] : [
    { icon: PersonIcon, color: 'text-primary', value: pri.length, label: 'Pasien' },
    { icon: SpeakerLoudIcon, color: 'text-pending', value: pri.reduce((s, r) => s + r.recordings, 0), label: 'Rekaman' },
    { icon: MixIcon, color: 'text-danger', value: pri.filter((r) => r.lab === 'Positif').length, label: 'Lab positif' },
    { icon: ActivityLogIcon, color: 'text-success', value: fmt.pct(pri.filter((r) => r.lab === 'Positif' && r.pred === 'TB').length / Math.max(1, pri.filter((r) => r.lab === 'Positif').length)), label: 'Recall pada data ini' },
  ];

  return (
    <AppLayout crumbs={[{ label: 'Data' }, { label: title }]}>
      <div className="intro-y mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="mr-auto"><h2 className="text-lg font-medium" title={desc}>{title}</h2></div>
        <Button onClick={exportCSV}><DownloadIcon />Export CSV</Button>
      </div>

      <div className="mt-5 grid grid-cols-12 gap-6">
        {boxes.map((b) => <div key={b.label} className="col-span-12 sm:col-span-6 xl:col-span-3"><ReportBox icon={b.icon} color={b.color} value={b.value} label={b.label} pill={'pill' in b ? b.pill : undefined} pillVariant={'pv' in b ? b.pv : 'success'} /></div>)}
      </div>

      <div className="intro-y mt-8 flex flex-wrap items-center gap-3">
        <ToggleGroup type="single" value={f} onValueChange={(v) => { setF(v || 'all'); pg.setPage(1); }} className="box p-1">
          {filters.map(([v, l]) => <ToggleGroupItem key={v} value={v} size="sm">{l}</ToggleGroupItem>)}
        </ToggleGroup>
        <div className="hidden text-muted-foreground md:block">Menampilkan {rows.length} data</div>
        <div className="relative w-full sm:ml-auto sm:w-56">
          <Input value={q} onChange={(e) => { setQ(e.target.value); pg.setPage(1); }} placeholder="Search..." className="box border-0 pr-9" aria-label="Cari" />
          <MagnifyingGlassIcon className="absolute inset-y-0 right-0 my-auto mr-3 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <div className="intro-y overflow-auto">
        <table className="table-report w-full min-w-[900px]">
          {src === 'webform' && <>
            <thead><tr><th>ID</th><th>Waktu</th><th>Nama</th><th>Gender</th><th>Umur</th><th>Gejala</th><th>Lama batuk</th><th className="!text-center">Rekaman</th><th>Hasil AI</th></tr></thead>
            <tbody>{(pg.slice as WebformRow[]).map((r) => (
              <tr key={r.id}><td className={td + ' font-medium'}>{r.id}</td><td className={td + ' whitespace-nowrap'}>{fmt.dateShort(r.time)}<div className="text-xs text-muted-foreground">{fmt.time(r.time)} WIB</div></td>
                <td className={td}><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.city}</div></td><td className={td}>{g(r.gender)}</td><td className={td + ' num'}>{r.age}</td>
                <td className={td}><div className="flex max-w-xs flex-wrap gap-1">{r.symptoms.length ? r.symptoms.map((s) => <Badge key={s} variant="secondary" className="font-normal">{s}</Badge>) : <span className="text-muted-foreground">–</span>}</div></td>
                <td className={td + ' whitespace-nowrap'}>{r.weeks ? `${r.weeks} minggu` : '< 1 minggu'}</td><td className={td + ' text-center num'}>{r.recordings}</td>
                <td className={td}><ResultBadge result={r.result} /><div className="mt-1 text-xs text-muted-foreground num">conf. {r.confidence.toFixed(3)}</div></td></tr>))}</tbody>
          </>}
          {src === 'offline' && <>
            <thead><tr><th>Kode</th><th>Tanggal</th><th>Lokasi pengambilan</th><th>Gender</th><th>Umur</th><th>Perangkat rekam</th><th className="!text-center">Rekaman</th><th>Label</th><th>Prediksi</th><th>Petugas</th></tr></thead>
            <tbody>{(pg.slice as OfflineRow[]).map((r) => (
              <tr key={r.id}><td className={td + ' font-medium'}>{r.id}</td><td className={td + ' whitespace-nowrap'}>{fmt.dateShort(r.time)}</td><td className={td}>{r.site}</td><td className={td}>{g(r.gender)}</td><td className={td + ' num'}>{r.age}</td><td className={td}>{r.mic}</td><td className={td + ' text-center num'}>{r.recordings}</td>
                <td className={td}><Badge variant={r.label === 'TB' ? 'soft-danger' : 'soft-success'}>{r.label === 'TB' ? 'TB' : 'Non-TB'}</Badge></td>
                <td className={td}>{r.pred === r.label ? <span className="flex items-center gap-1 text-success"><CheckCircledIcon className="h-4 w-4" />{r.pred === 'TB' ? 'TB' : 'Non-TB'}</span> : <Badge variant="soft-warning">{r.pred === 'TB' ? 'TB' : 'Non-TB'} · meleset</Badge>}</td>
                <td className={td}>{r.collector}</td></tr>))}</tbody>
          </>}
          {src === 'primer' && <>
            <thead><tr><th>Kode pasien</th><th>Tanggal</th><th>Gender</th><th>Umur</th><th>Pemeriksaan</th><th>Hasil lab</th><th>Fase OAT</th><th className="!text-center">Rekaman</th><th>Prediksi AI</th></tr></thead>
            <tbody>{(pg.slice as PrimerRow[]).map((r) => (
              <tr key={r.id}><td className={td + ' font-medium'}>{r.id}</td><td className={td + ' whitespace-nowrap'}>{fmt.dateShort(r.time)}</td><td className={td}>{g(r.gender)}</td><td className={td + ' num'}>{r.age}</td><td className={td}>{r.method}</td>
                <td className={td}><Badge variant={r.lab === 'Positif' ? 'destructive' : 'success'}>{r.lab}</Badge></td><td className={td}>{r.phase}</td><td className={td + ' text-center num'}>{r.recordings}</td>
                <td className={td}>{r.pred === 'TB' ? 'TB' : 'Non-TB'} <span className="text-muted-foreground num">({r.confidence.toFixed(2)})</span></td></tr>))}</tbody>
          </>}
        </table>
        {!rows.length && <div className="box p-10 text-center text-muted-foreground">Kosong</div>}
      </div>
      <TablePager page={pg.page} pages={pg.pages} onPage={pg.setPage} size={pg.size} onSize={pg.setSize} />
    </AppLayout>
  );
}
