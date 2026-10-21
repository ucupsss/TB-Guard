'use client';

import * as React from 'react';
import { Area, AreaChart, ResponsiveContainer, XAxis } from 'recharts';
import { ExclamationTriangleIcon, PauseIcon, PlayIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { simulateArray, type SimResult, type StereoDoa } from '@/lib/doa';
import { cn } from '@/lib/utils';

function Stat({ k, v, className }: { k: string; v: React.ReactNode; className?: string }) {
  return <div className={className}><div className="text-xs text-muted-foreground">{k}</div><div className="num mt-1 font-medium">{v}</div></div>;
}

function Field({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="num font-medium">{value}</span></div>
      {children}
    </div>
  );
}

const signed = (v: number, d = 0) => `${v > 0 ? '+' : ''}${v.toFixed(d)}`;

/** plot polar respons SRP-PHAT 0–360°, 0° di kanan, berlawanan jarum jam */
function Polar({ sim, trueAz, interAz }: { sim: SimResult; trueAz: number; interAz: number | null }) {
  const S = 240, c = S / 2, R = 92;
  const pt = (az: number, r: number) => [c + r * Math.cos((az * Math.PI) / 180), c - r * Math.sin((az * Math.PI) / 180)];
  const path = sim.srp.map((s, i) => { const [x, y] = pt(s.az, 18 + s.v * (R - 18)); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(' ') + 'Z';
  const ray = (az: number, cls: string, dash?: string) => { const [x, y] = pt(az, R + 4); return <line x1={c} y1={c} x2={x} y2={y} className={cls} strokeWidth="2" strokeDasharray={dash} />; };
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto block w-full max-w-[260px]" role="img" aria-label="Respons SRP-PHAT per sudut">
      {[0.33, 0.66, 1].map((k) => <circle key={k} cx={c} cy={c} r={R * k} fill="none" className="stroke-slate-200 dark:stroke-white/10" />)}
      {[0, 90, 180, 270].map((a) => { const [x, y] = pt(a, R + 16); return <text key={a} x={x} y={y + 4} textAnchor="middle" fontSize="10" className="fill-muted-foreground">{a}°</text>; })}
      <path d={path} className="fill-primary/15 stroke-primary dark:stroke-blue-300" strokeWidth="1.5" />
      {interAz !== null && ray(interAz, 'stroke-pending', '4 4')}
      {ray(trueAz, 'stroke-success', '6 4')}
      {ray(sim.estAz, 'stroke-primary dark:stroke-blue-300')}
      {/* posisi 4 mic (diperbesar) */}
      {[0, 90, 180, 270].map((a) => { const [x, y] = pt(a, 10); return <circle key={a} cx={x} cy={y} r="2.5" className="fill-foreground" />; })}
    </svg>
  );
}

let playCtx: AudioContext | null = null;
let playing: AudioBufferSourceNode | null = null;
function play(x: Float32Array, fs: number, onEnd: () => void) {
  playCtx ??= new AudioContext();
  playing?.stop();
  const peak = x.reduce((m, v) => Math.max(m, Math.abs(v)), 1e-6), buf = playCtx.createBuffer(1, x.length, fs);
  buf.getChannelData(0).set(x.map((v) => (v / peak) * 0.8));
  const src = playCtx.createBufferSource(); src.buffer = buf; src.connect(playCtx.destination);
  src.onended = () => { if (playing === src) playing = null; onEnd(); };
  src.start(); playing = src;
}

function SimTab({ mono }: { mono: AudioBuffer }) {
  const [az, setAz] = React.useState(60);
  const [snr, setSnr] = React.useState(5);
  const [interOn, setInterOn] = React.useState(true);
  const [interAz, setInterAz] = React.useState(210);
  const [sir, setSir] = React.useState(0);
  const [now, setNow] = React.useState<'mic' | 'beam' | null>(null);
  const params = React.useMemo(() => ({ az, snr, interOn, interAz, sir }), [az, snr, interOn, interAz, sir]);
  const opts = React.useDeferredValue(params); // slider tetap mulus, hitungan menyusul
  const data = React.useMemo(() => mono.getChannelData(0).slice(), [mono]);
  const sim = React.useMemo(
    () => simulateArray(data, mono.sampleRate, { az: opts.az, snrDb: opts.snr, interferer: opts.interOn ? { az: opts.interAz, sirDb: opts.sir } : null }),
    [data, mono.sampleRate, opts],
  );
  React.useEffect(() => () => { playing?.stop(); }, []);
  const listen = (which: 'mic' | 'beam') => {
    if (now === which) { playing?.stop(); setNow(null); return; }
    setNow(which); play(which === 'mic' ? sim.noisyMic : sim.beamOut, sim.fs, () => setNow((v) => (v === which ? null : v)));
  };
  const gain = sim.snrBeamDb - sim.snrMicDb;

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 space-y-5 lg:col-span-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Rekaman batuk Anda diletakkan secara virtual di sekitar mic array TB Guard (ReSpeaker 4 mic, radius 32 mm), lalu diberi bising.
          Sistem harus menemukan kembali sudutnya tanpa mengetahui jawaban.
        </p>
        <Field label="Sudut sumber batuk (jawaban)" value={`${az}°`}><Slider value={[az]} min={0} max={359} step={1} onValueChange={([v]) => setAz(v)} /></Field>
        <Field label="SNR bising sensor" value={`${snr} dB`}><Slider value={[snr]} min={-10} max={30} step={1} onValueChange={([v]) => setSnr(v)} /></Field>
        <label className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Sumber bising terarah (obrolan/pengumuman)</span>
          <Switch checked={interOn} onCheckedChange={setInterOn} aria-label="Sumber bising terarah" />
        </label>
        {interOn && <>
          <Field label="Sudut sumber bising" value={`${interAz}°`}><Slider value={[interAz]} min={0} max={359} step={1} onValueChange={([v]) => setInterAz(v)} /></Field>
          <Field label="Rasio batuk : bising" value={`${sir} dB`}><Slider value={[sir]} min={-10} max={20} step={1} onValueChange={([v]) => setSir(v)} /></Field>
        </>}
      </div>

      <div className="col-span-12 sm:col-span-6 lg:col-span-4">
        <Polar sim={sim} trueAz={opts.az} interAz={opts.interOn ? opts.interAz : null} />
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-success" />Sudut asli</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-primary" />Estimasi SRP-PHAT</span>
          {opts.interOn && <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-pending" />Sumber bising</span>}
        </div>
      </div>

      <div className="col-span-12 space-y-4 sm:col-span-6 lg:col-span-4">
        <div className="grid grid-cols-2 gap-4">
          <Stat k="Estimasi sudut" v={`${sim.estAz.toFixed(1)}°`} />
          <Stat k="Error" v={<span className={sim.errDeg <= 10 ? 'text-success' : 'text-danger'}>{sim.errDeg.toFixed(1)}°</span>} />
          <Stat k="SNR 1 mic" v={`${sim.snrMicDb.toFixed(1)} dB`} />
          <Stat k="SNR setelah beamforming" v={<>{sim.snrBeamDb.toFixed(1)} dB <span className="text-xs text-success">({signed(gain, 1)} dB)</span></>} />
        </div>
        <div>
          <div className="mb-1.5 text-xs text-muted-foreground">TDOA GCC-PHAT (asli / estimasi)</div>
          <div className="space-y-1 text-xs">
            {sim.pairs.map((p) => <div key={p.label} className="flex justify-between"><span>{p.label}</span><span className="num font-medium">{p.trueUs.toFixed(0)} / {p.estUs.toFixed(0)} µs</span></div>)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => listen('mic')}>{now === 'mic' ? <PauseIcon /> : <PlayIcon />}1 mic (bising)</Button>
          <Button size="sm" variant="outline" onClick={() => listen('beam')}>{now === 'beam' ? <PauseIcon /> : <PlayIcon />}Hasil beamforming</Button>
        </div>
      </div>
    </div>
  );
}

function StereoTab({ stereo, micCm, onMicCm, swap, onSwap }: { stereo: StereoDoa | null; micCm: number; onMicCm: (v: number) => void; swap: boolean; onSwap: (v: boolean) => void }) {
  if (!stereo) return <p className="text-muted-foreground">Rekam batuk dulu untuk menghitung arah suara.</p>;
  if (!stereo.ok) return (
    <div className="flex gap-3 rounded-md bg-pending/10 p-4">
      <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-pending" />
      <div>
        <div className="font-medium text-[#b45c00] dark:text-pending">Arah suara tidak bisa diukur di laptop ini</div>
        <p className="mt-1 text-muted-foreground">{stereo.reason} GCC-PHAT butuh minimal 2 kanal mic yang berbeda.</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Di Windows, coba <span className="font-medium text-foreground">Settings → System → Sound → Microphone → matikan Audio enhancements / Voice Clarity</span>, lalu muat ulang halaman.
          Bila tetap mono, gunakan tab <span className="font-medium text-foreground">Simulasi mic array</span>.
        </p>
      </div>
    </div>
  );
  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 space-y-4 lg:col-span-4">
        <div className="grid grid-cols-2 gap-4">
          <Stat k="Azimuth" v={<span className="text-primary dark:text-blue-300">{signed(stereo.azimuth)}° {Math.abs(stereo.azimuth) < 5 ? '(depan)' : stereo.azimuth > 0 ? '(kanan)' : '(kiri)'}</span>} />
          <Stat k="TDOA kiri–kanan" v={`${signed(stereo.tauUs)} µs`} />
          <Stat k="Confidence (puncak PHAT)" v={stereo.confidence.toFixed(2)} />
          <Stat k="SNR 1 mic → beamforming" v={`${stereo.snrMicDb.toFixed(1)} → ${stereo.snrBeamDb.toFixed(1)} dB`} />
        </div>
        <Field label="Jarak antar-mic laptop" value={`${micCm} cm`}><Slider value={[micCm]} min={2} max={30} step={0.5} onValueChange={([v]) => onMicCm(v)} /></Field>
        <label className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Tukar kanal kiri/kanan</span>
          <Switch checked={swap} onCheckedChange={onSwap} aria-label="Tukar kanal kiri/kanan" />
        </label>
      </div>
      <div className="col-span-12 lg:col-span-8">
        <div className="text-xs text-muted-foreground">Korelasi silang GCC-PHAT (mic kiri–kanan)</div>
        <div className="mt-2 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stereo.curve} margin={{ left: 0, right: 0, top: 8 }}>
              <XAxis dataKey="lagMs" tickLine={false} axisLine={false} fontSize={10} minTickGap={40} tickFormatter={(v) => `${v} ms`} />
              <Area type="monotone" dataKey="v" stroke="#1C3FAA" fill="#1C3FAA" fillOpacity={0.12} strokeWidth={1.5} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Puncak kurva = selisih waktu suara tiba di mic kiri dan kanan. Arahnya ditandai garis kuning pada gambar kamera dan dipakai untuk membobot wajah yang searah.
          Jarak mic tiap laptop berbeda; bila sudut terasa terlalu kecil atau besar, sesuaikan jaraknya. Bila kiri-kanan terbalik, aktifkan tukar kanal.
        </p>
      </div>
    </div>
  );
}

/** panel estimasi arah datang suara di halaman uji suara */
export function DoaPanel(props: { stereo: StereoDoa | null; mono: AudioBuffer; micCm: number; onMicCm: (v: number) => void; swap: boolean; onSwap: (v: boolean) => void }) {
  const [tab, setTab] = React.useState(props.stereo?.ok ? 'stereo' : 'sim');
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <div className="font-medium">Estimasi Arah Datang Suara</div>
          <div className="text-xs text-muted-foreground">Direction of Arrival · GCC-PHAT + SRP-PHAT (inverse beamforming)</div>
        </div>
        <Badge variant={props.stereo?.ok ? 'soft-success' : 'soft-warning'}>{props.stereo?.ok ? 'Mic laptop: 2 kanal' : 'Mic laptop: mono'}</Badge>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="stereo">Mic laptop (2 mic)</TabsTrigger>
          <TabsTrigger value="sim">Simulasi mic array TB Guard</TabsTrigger>
        </TabsList>
        <TabsContent value="stereo" className={cn('mt-4')}><StereoTab {...props} /></TabsContent>
        <TabsContent value="sim" className="mt-4"><SimTab mono={props.mono} /></TabsContent>
      </Tabs>
    </div>
  );
}
