'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarDays, CircleAlert, Plus, Search, AudioWaveform } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PersonAvatar } from '@/components/tb/common';
import { useStore, NOW, STAGES } from '@/lib/store';
import { fmt } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Patient } from '@/lib/types';

const COLORS = ['bg-danger', 'bg-pending', 'bg-warning', 'bg-primary', 'bg-success'];
const HINT = ['Batuk TB dari perangkat', 'Rujukan TCM / dahak', 'Hasil lab positif', 'OAT intensif / lanjutan', 'Pengobatan lengkap'];
const FACILITIES = ['RSKI Universitas Airlangga', 'Puskesmas Gubeng', 'Puskesmas Tambaksari', 'RSUD Dr. Soetomo'];

export default function Patients() {
  const { patients, addPatient, detection } = useStore();
  const sp = useSearchParams();
  const [q, setQ] = React.useState('');
  const [stage, setStage] = React.useState<number | null>(null);
  const [open, setOpen] = React.useState<Patient | null>(() => patients.find((x) => x.id === sp?.get('open')) ?? null);
  const [creating, setCreating] = React.useState(false);
  const fromDet = sp?.get('from') ? detection(sp.get('from')!) : undefined;
  const [banner, setBanner] = React.useState(true);
  const [form, setForm] = React.useState({ name: '', gender: 'L', age: '', phone: '', facility: FACILITIES[0], uuid: '' });
  const [err, setErr] = React.useState('');

  const startNew = (pref?: Partial<typeof form>) => { setForm({ name: '', gender: 'L', age: '', phone: '', facility: FACILITIES[0], uuid: '', ...pref }); setErr(''); setCreating(true); };

  const list = patients.filter((p) => !q || [p.name, p.id, p.facility, p.pic].join(' ').toLowerCase().includes(q.toLowerCase()));
  const max = Math.max(1, ...STAGES.map((_, i) => patients.filter((p) => p.stage === i).length));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setErr('Nama lengkap wajib diisi.');
    const now = NOW.getTime();
    addPatient({ id: 'PSN-' + (2600 + patients.length), name: form.name.trim(), gender: form.gender as 'L' | 'P', age: form.age || '–', nik: '–', phone: form.phone, facility: form.facility,
      stage: 0, start: now, daysIn: 0, uuid: form.uuid || '—', adherence: null, nextVisit: now + 3 * 86400000, pic: 'Belum ditentukan',
      events: [{ stage: 0, t: now, text: 'Didaftarkan ke pelacakan' + (form.uuid ? ' dari deteksi ' + form.uuid : '') }] });
    setCreating(false); setBanner(false);
    toast.success(`${form.name} didaftarkan`, { description: 'Demo: belum tersimpan permanen.' });
  };

  return (
    <AppLayout crumbs={[{ label: 'Pelacakan Pasien' }]}>
      <div className="intro-y mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="mr-auto"><h2 className="text-lg font-medium">Pelacakan Pasien</h2><p className="mt-1 text-muted-foreground">Dari terdeteksi hingga sembuh: pantau setiap individu yang terindikasi TB oleh perangkat.</p></div>
        <Button onClick={() => startNew()}><Plus />Daftarkan Pasien</Button>
      </div>

      {fromDet && banner && (
        <div className="intro-y mt-5 flex flex-wrap items-center gap-3 rounded-md bg-primary px-4 py-3 text-white shadow-box">
          <CircleAlert className="h-5 w-5" />
          <span className="flex-1">Deteksi <b>{fromDet.uuid}</b> terindikasi TB (confidence {fromDet.confidence.toFixed(2)}). Lengkapi identitas individu untuk mulai pelacakan.</span>
          <Button variant="white" size="sm" onClick={() => startNew({ uuid: fromDet.uuid, name: fromDet.name, age: String(fromDet.age || ''), gender: fromDet.gender || 'L' })}>Isi data pasien</Button>
        </div>
      )}

      {/* ringkasan per tahap */}
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {STAGES.map((s, i) => {
          const n = patients.filter((p) => p.stage === i).length;
          return (
            <button key={s} onClick={() => setStage(stage === i ? null : i)} aria-pressed={stage === i}
              className={cn('intro-y box p-4 text-left transition hover:shadow-box-lg', stage === i && 'ring-2 ring-primary')}>
              <div className="text-2xl font-medium num">{n}</div>
              <div className="text-muted-foreground">{i + 1}. {s}</div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary"><div className={cn('h-full rounded-full', COLORS[i])} style={{ width: `${(n / max) * 100}%` }} /></div>
            </button>
          );
        })}
      </div>

      <div className="intro-y mt-6 flex items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, ID, faskes..." className="box border-0 pr-9" aria-label="Cari pasien" />
          <Search className="absolute inset-y-0 right-0 my-auto mr-3 h-4 w-4 text-muted-foreground" />
        </div>
        <div className="ml-auto hidden text-muted-foreground sm:block">{list.length} pasien</div>
      </div>

      {/* papan kanban */}
      <div className="mt-5 grid gap-4 overflow-x-auto pb-2 md:grid-cols-[repeat(5,minmax(200px,1fr))]">
        {STAGES.map((s, i) => {
          if (stage !== null && stage !== i) return null;
          const items = list.filter((p) => p.stage === i);
          return (
            <div key={s} className="intro-y rounded-md bg-slate-200/50 p-3 dark:bg-white/5">
              <div className="mb-1 flex items-center px-1"><span className={cn('mr-2 h-2.5 w-2.5 rounded-full', COLORS[i])} /><span className="font-medium">{s}</span><Badge variant="secondary" className="ml-auto bg-card">{items.length}</Badge></div>
              <div className="mb-3 px-1 text-xs text-muted-foreground">{HINT[i]}</div>
              {items.map((p) => (
                <button key={p.id} onClick={() => setOpen(p)} className="box mb-3 block w-full p-4 text-left transition hover:shadow-box-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="flex items-center gap-3"><PersonAvatar name={p.name} className="h-9 w-9" /><div className="min-w-0"><div className="truncate font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.id} · {p.gender}, {p.age} th</div></div></div>
                  <div className="mt-2 truncate text-xs text-muted-foreground">{p.facility}</div>
                  {p.adherence != null && <Progress value={p.adherence} className="mt-3 h-1.5" indicatorClassName={p.adherence < 85 ? 'bg-pending' : 'bg-success'} />}
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span>{p.adherence != null ? <>Kepatuhan <b className="num">{p.adherence}%</b></> : `Hari ke-${p.daysIn}`}</span>
                    <span className="flex items-center gap-1 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{p.nextVisit ? fmt.dayShort(p.nextVisit) : 'Selesai'}</span>
                  </div>
                </button>
              ))}
              {!items.length && <div className="rounded-md border border-dashed border-slate-300 py-6 text-center text-xs text-muted-foreground dark:border-white/15">Kosong</div>}
            </div>
          );
        })}
      </div>

      {/* detail pasien */}
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent>
          {open && <>
            <SheetHeader className="pr-6">
              <div className="flex items-center gap-3"><PersonAvatar name={open.name} className="h-12 w-12" /><div><SheetTitle>{open.name}</SheetTitle><SheetDescription>{open.id} · {STAGES[open.stage]}</SheetDescription></div></div>
            </SheetHeader>
            <div className="mt-5 flex gap-1">{STAGES.map((_, i) => <span key={i} className={cn('h-1.5 flex-1 rounded-full', i <= open.stage ? 'bg-primary' : 'bg-secondary')} />)}</div>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
              {[['NIK', open.nik], ['Gender, umur', `${open.gender === 'L' ? 'Laki-laki' : 'Perempuan'}, ${open.age} th`], ['Faskes', open.facility], ['Penanggung jawab', open.pic], ['Kepatuhan obat', open.adherence != null ? open.adherence + '%' : '–'], ['Kontrol berikut', open.nextVisit ? fmt.date(open.nextVisit) : 'Selesai']].map(([k, v]) => (
                <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 font-medium">{v}</dd></div>
              ))}
            </dl>
            <div className="mt-6 font-medium">Linimasa</div>
            <ol className="relative mt-3 border-l border-slate-200 pl-5 dark:border-white/10">
              {open.events.map((ev, i) => (
                <li key={i} className="mb-4"><span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-primary ring-4 ring-card" /><div className="font-medium">{STAGES[ev.stage]}</div><div className="text-muted-foreground">{ev.text}</div><div className="text-xs text-muted-foreground">{fmt.date(ev.t)}</div></li>
              ))}
              {STAGES.map((s, i) => i > open.stage && (
                <li key={s} className="mb-4"><span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-dashed border-slate-300 bg-card" /><div className="text-muted-foreground">{s}</div><div className="text-xs text-muted-foreground">Belum tercapai</div></li>
              ))}
            </ol>
            {open.uuid && open.uuid !== '—' && <Button asChild variant="outline" className="mt-2"><Link href={`/detections/${open.uuid}`}><AudioWaveform />Lihat deteksi awal</Link></Button>}
          </>}
        </SheetContent>
      </Sheet>

      {/* daftar pasien baru */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <form onSubmit={submit} className="grid gap-5">
            <DialogHeader><DialogTitle>Daftarkan Pasien</DialogTitle><DialogDescription>Pelacakan dimulai dari tahap Terdeteksi.</DialogDescription></DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2"><Label htmlFor="nName">Nama lengkap</Label><Input id="nName" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid gap-3 sm:col-span-2"><Label>Gender</Label>
                <RadioGroup value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })} className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="L" />Laki-laki</label>
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="P" />Perempuan</label>
                </RadioGroup></div>
              <div className="grid gap-2"><Label htmlFor="nAge">Umur</Label><Input id="nAge" type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></div>
              <div className="grid gap-2"><Label htmlFor="nPhone">No. HP</Label><Input id="nPhone" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="grid gap-2 sm:col-span-2"><Label>Faskes rujukan</Label>
                <Select value={form.facility} onValueChange={(v) => setForm({ ...form, facility: v })}><SelectTrigger aria-label="Faskes rujukan"><SelectValue /></SelectTrigger>
                  <SelectContent>{FACILITIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-2 sm:col-span-2"><Label htmlFor="nUuid">UUID deteksi</Label><Input id="nUuid" value={form.uuid} onChange={(e) => setForm({ ...form, uuid: e.target.value })} placeholder="opsional" /></div>
            </div>
            {err && <p role="alert" className="text-sm text-danger">{err}</p>}
            <DialogFooter><Button type="button" variant="outline" onClick={() => setCreating(false)}>Batal</Button><Button type="submit">Daftarkan</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
