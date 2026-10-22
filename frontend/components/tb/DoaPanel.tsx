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
        <Field label="Sudut batuk" value={`${az}°`}><Slider value={[az]} min={0} max={359} step={1} onValueChange={([v]: number[]) => setAz(v)} /></Field>
        <Field label="SNR" value={`${snr} dB`}><Slider value={[snr]} min={-10} max={30} step={1} onValueChange={([v]: number[]) => setSnr(v)} /></Field>
        <label className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground" title="Obrolan / pengumuman dari satu arah">Bising terarah</span>
          <Switch checked={interOn} onCheckedChange={setInterOn} aria-label="Sumber bising terarah" />
        </label>
        {interOn && <>
          <Field label="Sudut bising" value={`${interAz}°`}><Slider value={[interAz]} min={0} max={359} step={1} onValueChange={([v]: number[]) => setInterAz(v)} /></Field>
          <Field label="Batuk : bising" value={`${sir} dB`}><Slider value={[sir]} min={-10} max={20} step={1} onValueChange={([v]: number[]) => setSir(v)} /></Field>
        </>}
      </div>

      <div className="col-span-12 sm:col-span-6 lg:col-span-4">
        <Polar sim={sim} trueAz={opts.az} interAz={opts.interOn ? opts.interAz : null} />
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-success" />Sudut asli</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-primary" />Estimasi</span>
          {opts.interOn && <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-pending" />Bising</span>}
        </div>
      </div>

      <div className="col-span-12 space-y-4 sm:col-span-6 lg:col-span-4">
        <div className="grid grid-cols-2 gap-4">
          <Stat k="Estimasi" v={`${sim.estAz.toFixed(1)}°`} />
          <Stat k="Error" v={<span className={sim.errDeg <= 10 ? 'text-success' : 'text-danger'}>{sim.errDeg.toFixed(1)}°</span>} />
          <Stat k="SNR 1 mic" v={`${sim.snrMicDb.toFixed(1)} dB`} />
          <Stat k="SNR beam" v={<>{sim.snrBeamDb.toFixed(1)} dB <span className="text-xs text-success">({signed(gain, 1)} dB)</span></>} />
        </div>
        <div>
          <div className="mb-1.5 text-xs text-muted-foreground">TDOA (asli / est.)</div>
          <div className="space-y-1 text-xs">
            {sim.pairs.map((p) => <div key={p.label} className="flex justify-between"><span>{p.label}</span><span className="num font-medium">{p.trueUs.toFixed(0)} / {p.estUs.toFixed(0)} µs</span></div>)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => listen('mic')}>{now === 'mic' ? <PauseIcon /> : <PlayIcon />}1 mic</Button>
          <Button size="sm" variant="outline" onClick={() => listen('beam')}>{now === 'beam' ? <PauseIcon /> : <PlayIcon />}Beam</Button>
        </div>
      </div>
    </div>
  );
}

function StereoTab({ stereo, micCm, onMicCm, swap, onSwap }: { stereo: StereoDoa | null; micCm: number; onMicCm: (v: number) => void; swap: boolean; onSwap: (v: boolean) => void }) {
  if (!stereo) return <p className="text-muted-foreground">Rekam batuk dulu.</p>;
  if (!stereo.ok) return (
    <div className="flex gap-3 rounded-md bg-pending/10 p-4">
      <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-pending" />
      <div>
        <div className="font-medium text-[#b45c00] dark:text-pending" title={`${stereo.reason} Butuh 2 kanal mic. Windows: Settings → System → Sound → Microphone → matikan Audio enhancements, lalu muat ulang. Bila tetap mono, pakai tab Simulasi.`}>Mic mono · DoA tidak tersedia</div>
      </div>
    </div>
  );
  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 space-y-4 lg:col-span-4">
        <div className="grid grid-cols-2 gap-4">
          <Stat k="Azimuth" v={<span className="text-primary dark:text-blue-300">{signed(stereo.azimuth)}° {Math.abs(stereo.azimuth) < 5 ? '(depan)' : stereo.azimuth > 0 ? '(kanan)' : '(kiri)'}</span>} />
          <Stat k="TDOA" v={`${signed(stereo.tauUs)} µs`} />
          <Stat k="Confidence" v={stereo.confidence.toFixed(2)} />
          <Stat k="SNR" v={`${stereo.snrMicDb.toFixed(1)} → ${stereo.snrBeamDb.toFixed(1)} dB`} />
        </div>
        <Field label="Jarak mic" value={`${micCm} cm`}><Slider value={[micCm]} min={2} max={30} step={0.5} onValueChange={([v]: number[]) => onMicCm(v)} /></Field>
        <label className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Tukar L/R</span>
          <Switch checked={swap} onCheckedChange={onSwap} aria-label="Tukar kanal kiri/kanan" />
        </label>
      </div>
      <div className="col-span-12 lg:col-span-8">
        <div className="text-xs text-muted-foreground" title="Puncak = selisih waktu tiba di mic kiri & kanan. Sesuaikan jarak mic bila sudut meleset; tukar L/R bila terbalik.">GCC-PHAT</div>
        <div className="mt-2 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stereo.curve} margin={{ left: 0, right: 0, top: 8 }}>
              <XAxis dataKey="lagMs" tickLine={false} axisLine={false} fontSize={10} minTickGap={40} tickFormatter={(v) => `${v} ms`} />
              <Area type="monotone" dataKey="v" stroke="#1C3FAA" fill="#1C3FAA" fillOpacity={0.12} strokeWidth={1.5} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
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
          <div className="font-medium" title="Direction of Arrival · GCC-PHAT + SRP-PHAT">Arah Suara (DoA)</div>
        </div>
        <Badge variant={props.stereo?.ok ? 'soft-success' : 'soft-warning'}>{props.stereo?.ok ? '2 kanal' : 'Mono'}</Badge>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="stereo">Laptop</TabsTrigger>
          <TabsTrigger value="sim">Simulasi</TabsTrigger>
        </TabsList>
        <TabsContent value="stereo" className={cn('mt-4')}><StereoTab {...props} /></TabsContent>
        <TabsContent value="sim" className="mt-4"><SimTab mono={props.mono} /></TabsContent>
      </Tabs>
    </div>
  );
}
