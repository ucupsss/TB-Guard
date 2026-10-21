'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Area, AreaChart, ResponsiveContainer, XAxis } from 'recharts';
import { ArrowLeft, AudioWaveform, Check, Pencil, Route as RouteIcon } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Gauge } from '@/components/tb/common';
import { CoughAudio, DoaChart, CameraFrame } from '@/components/tb/Analysis';
import { AiClinicalCopilot } from '@/components/tb/AiClinicalCopilot';
import { EditDetectionDialog } from '@/components/tb/EditDetectionDialog';
import { useStore } from '@/lib/store';
import { azText, fmt } from '@/lib/format';
import { cn } from '@/lib/utils';

function Field({ k, v, className }: { k: string; v: React.ReactNode; className?: string }) {
  return <div className={className}><div className="text-xs text-muted-foreground">{k}</div><div className="mt-1 font-medium">{v}</div></div>;
}

export default function CoughDetail() {
  const params = useParams<{ uuid: string }>();
  const uuid = params?.uuid ?? '';
  const { detection, device, updateDetection } = useStore();
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const play = React.useRef<(() => void) | null>(null);
  const audioRef = React.useRef<HTMLDivElement>(null);
  const d = detection(uuid);
  React.useEffect(() => { if (window.location.hash === '#audio') setTimeout(() => audioRef.current?.scrollIntoView({ behavior: 'smooth' }), 400); }, []);

  if (!d) return <AppLayout crumbs={[{ label: 'Devices', to: '/devices' }, { label: 'Tidak ditemukan' }]}><div className="box mt-8 p-10 text-center">Data tidak ditemukan. <Link className="text-primary" href="/devices">Kembali</Link></div></AppLayout>;
  const dev = device(d.deviceId)!;
  const tb = d.result === 'TB';
  const pTB = tb ? d.confidence : 1 - d.confidence;
  const lag = d.doa.tdoa[1];
  const rng = { s: d.uuid.charCodeAt(2) * 31 };
  const noise = () => { rng.s = (rng.s * 9301 + 49297) % 233280; return rng.s / 233280 - 0.5; };
  const gcc = Array.from({ length: 81 }, (_, i) => { const x = -0.4 + i * 0.01; return { x: x.toFixed(2), y: Math.max(0, Math.exp(-Math.pow((x - lag) / 0.018, 2)) + noise() * 0.1) }; });
  const cek = () => { audioRef.current?.scrollIntoView({ behavior: 'smooth' }); play.current?.(); };

  return (
    <AppLayout crumbs={[{ label: 'Devices', to: '/devices' }, { label: dev.name, to: `/devices/${dev.id}` }, { label: d.uuid }]}>
      <div className="intro-y mt-8 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-medium">Detail Data Batuk</h2>
        <Button variant="outline" className="box border-0" onClick={() => setEditing(true)}><Pencil />Edit Data</Button>
        <Button variant="secondary" onClick={() => router.push(`/devices/${dev.id}`)}><ArrowLeft />Kembali</Button>
      </div>

      <div className="mt-5 grid grid-cols-12 gap-6">
        {/* info + hasil */}
        <div className="intro-y box col-span-12 p-5 lg:col-span-8">
          <div className="mb-5 flex items-center border-b border-slate-200/60 pb-5 dark:border-white/10">
            <div className="font-medium">Detail Data Batuk</div>
            <Badge variant={tb ? 'destructive' : 'success'} className="ml-auto">{tb ? 'Terindikasi TB' : 'Negatif TB'}</Badge>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Field k="UUID" v={d.uuid} />
            <Field k="Device ID" v={dev.id} />
            <Field k="Nama Device" v={<Link href={`/devices/${dev.id}`} className="text-primary dark:text-blue-300">{dev.name}</Link>} />
            <Field k="Lokasi Device" v={<>{dev.zone.split(' – ')[0]}<div className="text-xs font-normal text-muted-foreground">{dev.location}</div></>} />
            <Field k="Nama Lengkap" v={d.name || '–'} />
            <Field k="Gender / Umur" v={`${d.gender ? (d.gender === 'L' ? 'Laki-laki' : 'Perempuan') : '–'} / ${d.age || '–'}`} />
            <Field k="Waktu Perekaman" v={fmt.longDate(d.time)} className="sm:col-span-3" />
          </div>
          <div className="my-5 border-t border-dashed border-slate-200 dark:border-white/10" />
          <div className="mb-4 font-medium">Hasil Analisis</div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Field k="Type" v={d.type} />
            <Field k="Jenis Batuk" v={<span className={tb ? 'text-danger' : ''}>{tb ? 'Terindikasi TB' : 'Negatif TB'}</span>} />
            <Field k="Confidence Score" v={<span className="text-primary num dark:text-blue-300">{d.confidence.toFixed(4)}</span>} />
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={cek}><AudioWaveform />Cek Suara Batuk</Button>
            {tb && !d.reviewed && <Button variant="outline" onClick={() => { updateDetection(d.uuid, { reviewed: true }); toast.success('Ditandai sudah ditinjau'); }}><Check />Tandai sudah ditinjau</Button>}
            {tb && <Button variant="outline" onClick={() => router.push(`/patients?from=${d.uuid}`)}><RouteIcon />Daftarkan ke pelacakan pasien</Button>}
          </div>
        </div>

        <div className="intro-y box col-span-12 p-5 lg:col-span-4">
          <div className="mb-5 border-b border-slate-200/60 pb-5 font-medium dark:border-white/10">Prediksi Model LSTM</div>
          <Gauge value={d.confidence} tb={tb} />
          <div className="mt-4 text-center">
            <div className={cn('text-xl font-medium', tb ? 'text-danger' : 'text-primary dark:text-blue-300')}>{tb ? 'Terindikasi TB' : 'Negatif TB'}</div>
            <div className="mt-1 text-muted-foreground">{tb ? (d.reviewed ? 'Sudah ditinjau tenaga kesehatan' : 'Perlu ditinjau dokter') : 'Tidak perlu tindak lanjut'}</div>
          </div>
          <div className="mt-5 grid gap-3">
            <div className="grid grid-cols-[56px_1fr_56px] items-center gap-3 text-sm"><span>TB</span><Progress value={pTB * 100} indicatorClassName="bg-danger" /><span className="text-right num">{fmt.pct(pTB)}</span></div>
            <div className="grid grid-cols-[56px_1fr_56px] items-center gap-3 text-sm"><span>Non-TB</span><Progress value={(1 - pTB) * 100} /><span className="text-right num">{fmt.pct(1 - pTB)}</span></div>
          </div>
        </div>

        {/* AI Training & LLM Clinical Integration */}
        <AiClinicalCopilot d={d} dev={dev} />

        {/* audio */}
        <div ref={audioRef} id="audio" className="intro-y box col-span-12 scroll-mt-6 p-5">
          <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-slate-200/60 pb-5 dark:border-white/10">
            <div className="mr-auto"><div className="font-medium">Hasil Suara Batuk</div><div className="text-xs text-muted-foreground">Waveform & Mel-spectrogram · segmen 1 detik, 16 kHz</div></div>
            <div className="flex flex-wrap gap-1.5">{['Segmentasi 1 s', 'Resample 16 kHz', 'STFT · Hann', 'Mel filter bank', 'DCT', '39 MFCC', 'LSTM'].map((s, i, a) => <Badge key={s} variant={i === a.length - 1 ? 'default' : 'soft-primary'}>{s}</Badge>)}</div>
          </div>
          <CoughAudio d={d} autoplayRef={play} />
          <div className="mt-4 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-[#8a6d00] dark:text-warning">Suara di demo ini sintetis. Sambungkan ke rekaman asli dari backend saat API siap.</div>
        </div>

        {/* DoA */}
        <div className="intro-y box col-span-12 p-5 lg:col-span-6">
          <div className="mb-5 border-b border-slate-200/60 pb-5 dark:border-white/10"><div className="font-medium">Estimasi Arah Datang Suara</div><div className="text-xs text-muted-foreground">Direction of Arrival · GCC-PHAT + inverse beamforming</div></div>
          <DoaChart d={d} dev={dev} />
          <div className="mt-4 grid grid-cols-2 gap-6">
            <dl className="grid gap-2 text-sm">
              {[['Azimuth', azText(d.doa.azimuth)], ['Confidence DoA', d.doa.confidence.toFixed(2)], ['SNR', fmt.dec(d.doa.snr, 1) + ' dB'], ...d.doa.tdoa.map((v, i) => [`TDOA m1–m${i + 2}`, fmt.dec(v, 3) + ' ms'])].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium num">{v}</dd></div>
              ))}
            </dl>
            <div>
              <div className="text-xs text-muted-foreground">Korelasi silang GCC-PHAT (mic 1–3)</div>
              <div className="h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={gcc} margin={{ left: 0, right: 0, top: 8 }}>
                    <XAxis dataKey="x" tickLine={false} axisLine={false} fontSize={10} interval={19} tickFormatter={(v) => `${v} ms`} />
                    <Area type="monotone" dataKey="y" stroke="#1C3FAA" fill="#1C3FAA" fillOpacity={0.12} strokeWidth={1.5} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* object detection */}
        <div className="intro-y box col-span-12 p-5 lg:col-span-6">
          <div className="mb-5 border-b border-slate-200/60 pb-5 dark:border-white/10"><div className="font-medium">Pelacakan Individu</div><div className="text-xs text-muted-foreground">Object detection pada frame kamera di timestamp batuk</div></div>
          <div className="overflow-hidden rounded-md"><CameraFrame d={d} dev={dev} /></div>
          <dl className="mt-4 grid gap-2 text-sm">
            {[['Status pelacakan', d.person.tracked ? <Badge key="a" variant="soft-success">Individu terlacak</Badge> : <Badge key="b" variant="soft-warning">Tidak terlacak</Badge>], ['ID pelacakan', d.person.tracked ? d.person.id : '–'], ['Skor kecocokan DoA ↔ bbox', d.person.tracked ? d.person.score.toFixed(2) : '–'], ['Orang dalam frame', d.person.crowd + (d.person.tracked ? 1 : 0)], ['Sinkronisasi timestamp', '±40 ms']].map(([k, v], i) => (
              <div key={i} className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium num">{v}</dd></div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">Wajah tidak ditampilkan dan tidak disimpan. Frame di demo adalah ilustrasi.</p>
        </div>
      </div>

      <EditDetectionDialog uuid={d.uuid} open={editing} onOpenChange={setEditing} />
    </AppLayout>
  );
}
