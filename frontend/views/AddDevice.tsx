'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { CameraIcon, CheckCircledIcon, CubeIcon, SewingPinIcon } from '@radix-ui/react-icons';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DeviceStatus } from '@/components/tb/common';
import { useStore, NOW } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { DeviceStatus as S } from '@/lib/types';

const STEPS = ['Identitas', 'Lokasi', 'Sensor', 'Tinjau'];

export default function AddDevice() {
  const { devices, device, addDevice } = useStore();
  const nextId = Math.max(...devices.map((d) => d.id)) + 1;
  const empty = { name: '', id: String(nextId), type: 'cough', location: '', zone: '', coords: '', status: 'active' as S, mics: '4', camera: true, note: '' };
  const [f, setF] = React.useState(empty);
  const [step, setStep] = React.useState(0);
  const [err, setErr] = React.useState('');
  const set = (k: keyof typeof f) => (v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  const validate = (s: number) => {
    if (s === 0) {
      if (!f.name.trim() || !f.id.trim()) return 'Nama dan Device ID wajib diisi.';
      if (!/^\d+$/.test(f.id)) return 'Device ID harus berupa angka.';
      if (device(f.id)) return `Device ID ${f.id} sudah dipakai ${device(f.id)!.name}.`;
    }
    if (s === 1 && !f.location.trim()) return 'Lokasi wajib diisi.';
    return '';
  };
  const go = (to: number) => {
    for (let s = step; s < to; s++) { const e = validate(s); if (e) { setErr(e); return; } }
    setErr(''); setStep(to);
  };
  const save = () => {
    const [lat, lng] = f.coords.split(',').map((x) => parseFloat(x));
    addDevice({ id: +f.id, name: f.name.trim(), type: f.type, status: f.status, location: f.location.trim(), zone: f.zone || '-', city: 'Surabaya', mics: +f.mics,
      array: f.mics === '6' ? 'Linear 6-Mic Array' : `ReSpeaker ${f.mics}-Mic Circular`, camera: f.camera ? 'USB Cam 1080p' : '—', fw: 'v1.3.2',
      installed: new Date(NOW).toISOString().slice(0, 10), lastSeen: NOW.getTime(), lat: Number.isFinite(lat) ? lat : -7.27, lng: Number.isFinite(lng) ? lng : 112.77 });
    toast.success(`${f.name} tersimpan`, { description: 'Demo: data belum permanen sampai backend tersambung.' });
    setF({ ...empty, id: String(+f.id + 1) }); setStep(0);
  };

  return (
    <AppLayout crumbs={[{ label: 'Devices', to: '/devices' }, { label: 'Add Device' }]}>
      <div className="intro-y mt-8 flex items-center"><h2 className="mr-auto text-lg font-medium">Add Device</h2></div>

      <div className="mt-5 grid grid-cols-12 gap-6">
        <div className="intro-y box col-span-12 py-10 sm:py-14 xl:col-span-8">
          {/* langkah wizard */}
          <ol className="relative flex justify-center px-5 before:absolute before:left-0 before:right-0 before:top-5 before:mx-auto before:hidden before:h-[3px] before:w-[70%] before:bg-slate-100 dark:before:bg-white/10 sm:px-16 lg:before:block">
            {STEPS.map((s, i) => (
              <li key={s} className="z-10 flex flex-1 flex-col items-center">
                <button type="button" onClick={() => (i <= step ? setStep(i) : go(i))} aria-current={i === step ? 'step' : undefined}
                  className={cn('h-10 w-10 rounded-full font-medium transition', i === step ? 'bg-primary text-white' : i < step ? 'bg-primary/15 text-primary dark:text-blue-300' : 'bg-slate-100 text-muted-foreground dark:bg-white/10')}>{i + 1}</button>
                <div className={cn('mt-3 text-center text-sm', i === step ? 'font-medium' : 'text-muted-foreground')}>{s}</div>
              </li>
            ))}
          </ol>

          <div className="mt-10 border-t border-slate-200/60 px-5 pt-10 dark:border-white/10 sm:px-16">
            <div className="text-base font-medium">{['Identitas perangkat', 'Lokasi pemasangan', 'Konfigurasi sensor', 'Tinjau lalu simpan'][step]}</div>
            <div className="mt-5 grid grid-cols-12 gap-4 gap-y-5">
              {step === 0 && <>
                <div className="col-span-12 grid gap-2 sm:col-span-6"><Label htmlFor="fName">Nama perangkat</Label><Input id="fName" value={f.name} onChange={(e) => set('name')(e.target.value)} placeholder="mis. TB Guard 5" /></div>
                <div className="col-span-12 grid gap-2 sm:col-span-6"><Label htmlFor="fId">Device ID</Label><Input id="fId" value={f.id} onChange={(e) => set('id')(e.target.value)} inputMode="numeric" /><span className="text-xs text-muted-foreground">Harus sama dengan ID di firmware.</span></div>
                <div className="col-span-12 grid gap-2 sm:col-span-6"><Label>Type</Label>
                  <Select value={f.type} onValueChange={set('type')}><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cough">cough</SelectItem><SelectItem value="cough+vision">cough + vision</SelectItem></SelectContent></Select></div>
              </>}
              {step === 1 && <>
                <div className="col-span-12 grid gap-2 sm:col-span-6"><Label htmlFor="fLoc">Lokasi</Label><Input id="fLoc" value={f.location} onChange={(e) => set('location')(e.target.value)} placeholder="mis. Stasiun Gubeng" /></div>
                <div className="col-span-12 grid gap-2 sm:col-span-6"><Label htmlFor="fZone">Zona / area</Label><Input id="fZone" value={f.zone} onChange={(e) => set('zone')(e.target.value)} placeholder="mis. Antrian – Ruang Tunggu" /></div>
                <div className="col-span-12 grid gap-2 sm:col-span-6"><Label htmlFor="fCoord">Koordinat (lat, lng)</Label><Input id="fCoord" value={f.coords} onChange={(e) => set('coords')(e.target.value)} placeholder="-7.2652, 112.7522" /></div>
                <div className="col-span-12 grid gap-3 sm:col-span-6"><Label>Status awal</Label>
                  <RadioGroup value={f.status} onValueChange={set('status')} className="flex gap-6">
                    <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="active" />Active</label>
                    <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="inactive" />Inactive</label>
                  </RadioGroup></div>
              </>}
              {step === 2 && <>
                <div className="col-span-12 grid gap-2 sm:col-span-6"><Label>Microphone array</Label>
                  <Select value={f.mics} onValueChange={set('mics')}><SelectTrigger aria-label="Microphone array"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="4">4 mic · circular</SelectItem><SelectItem value="6">6 mic · linear</SelectItem><SelectItem value="8">8 mic · circular</SelectItem></SelectContent></Select></div>
                <label className="col-span-12 flex items-center justify-between gap-4 rounded-md border border-slate-200 p-4 dark:border-white/10 sm:col-span-6">
                  <span><span className="block font-medium">Kamera object detection</span><span className="text-xs text-muted-foreground">Untuk melacak individu sumber batuk</span></span>
                  <Switch checked={f.camera} onCheckedChange={set('camera')} aria-label="Kamera object detection" />
                </label>
                <div className="col-span-12 grid gap-2"><Label htmlFor="fNote">Catatan pemasangan</Label><Textarea id="fNote" value={f.note} onChange={(e) => set('note')(e.target.value)} placeholder="Tinggi pemasangan, arah hadap kamera, kontak PIC lokasi..." /></div>
              </>}
              {step === 3 && (
                <dl className="col-span-12 grid grid-cols-1 gap-4 rounded-md border border-dashed border-slate-300 p-5 dark:border-white/20 sm:grid-cols-3">
                  {[['Nama', f.name], ['Device ID', f.id], ['Type', f.type], ['Lokasi', f.location], ['Zona', f.zone || '–'], ['Status awal', f.status === 'active' ? 'Active' : 'Inactive'], ['Mic array', f.mics + ' mic'], ['Kamera', f.camera ? 'Terpasang' : 'Tidak'], ['Koordinat', f.coords || '–']].map(([k, v]) => (
                    <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 font-medium">{v}</dd></div>
                  ))}
                </dl>
              )}
              {err && <p role="alert" className="col-span-12 text-sm text-danger">{err}</p>}
              <div className="col-span-12 mt-5 flex items-center justify-center gap-2 sm:justify-end">
                <Button variant="secondary" className="w-24" disabled={step === 0} onClick={() => { setErr(''); setStep(step - 1); }}>Previous</Button>
                {step < 3 ? <Button className="w-24" onClick={() => go(step + 1)}>Next</Button> : <Button className="w-32" onClick={save}>Simpan</Button>}
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 xl:col-span-4">
          <div className="intro-y box p-5">
            <div className="mb-4 font-medium">Pratinjau</div>
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary dark:text-blue-300"><CubeIcon className="h-7 w-7" /></div>
              <div className="min-w-0"><div className="truncate font-medium">{f.name || 'Nama perangkat'}</div><div className="text-xs text-muted-foreground">TB Guard Device · ID {f.id || '–'}</div></div>
            </div>
            <div className="mt-4 flex items-center gap-1 text-muted-foreground"><SewingPinIcon className="h-4 w-4" />{f.location || 'Lokasi'}{f.zone && ` · ${f.zone}`}</div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200/70 pt-4 dark:border-white/10">
              <DeviceStatus status={f.status} /><span className="text-muted-foreground">·</span><span>{f.type}</span><span className="text-muted-foreground">·</span><span>{f.mics} mic</span>
              {f.camera && <span className="flex items-center gap-1"><CameraIcon className="h-4 w-4" />kamera</span>}
            </div>
          </div>
          <div className="intro-y box mt-5 p-5">
            <div className="mb-4 font-medium">Checklist pemasangan</div>
            {[['Pasang mic array setinggi ±2 m', 'Hindari dekat speaker pengumuman / AC'], ['Arahkan kamera ke area duduk', 'FOV kamera harus mencakup sudut DoA ±39°'], ['Sambungkan ke jaringan', 'Perangkat mengirim data ke server setiap deteksi'], ['Uji dengan rekaman batuk', 'Pastikan muncul di Device Data']].map(([t, s]) => (
              <div key={t} className="mt-3 flex gap-3 first:mt-0"><CheckCircledIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" /><div><div className="font-medium">{t}</div><div className="text-xs text-muted-foreground">{s}</div></div></div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
