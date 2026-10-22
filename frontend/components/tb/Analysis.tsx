'use client';

import * as React from 'react';
import type WaveSurfer from 'wavesurfer.js';
import { PauseIcon, PlayIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { synthCough, toWavBlob } from '@/lib/audio';
import { backendFetch } from '@/lib/backend';
import { azText } from '@/lib/format';
import type { Detection, Device } from '@/lib/types';

/** waveform + Mel-spectrogram (wavesurfer.js); suara demo sintetis */
export function CoughAudio({ d, autoplayRef }: { d: Detection; autoplayRef?: React.MutableRefObject<(() => void) | null> }) {
  const wave = React.useRef<HTMLDivElement>(null);
  const spec = React.useRef<HTMLDivElement>(null);
  const ws = React.useRef<WaveSurfer | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [time, setTime] = React.useState('0:00 / 0:00');
  const tb = d.result === 'TB';
  const seconds = tb ? 7 : 5;
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  React.useEffect(() => {
    if (!wave.current || !spec.current) return;
    let alive = true;
    let w: WaveSurfer | null = null;
    let url = '';
    let blobUrl = '';
    // colormap: putih → biru muda → biru primer → navy
    const stops = [[255, 255, 255], [190, 207, 245], [28, 63, 170], [12, 24, 70]];
    const cmap = Array.from({ length: 256 }, (_, i) => {
      const t = (i / 255) * (stops.length - 1), k = Math.min(stops.length - 2, Math.floor(t)), f = t - k;
      return [...stops[k].map((c, j) => (c + (stops[k + 1][j] - c) * f) / 255), 1];
    });
    // rekaman dari Neon Object Storage; bila belum ada, pakai suara sintetis sebagai cadangan
    const source = backendFetch(`/api/detections/${encodeURIComponent(d.uuid)}/audio`)
      .then((r) => (r.ok ? r.json() : null)).then((j) => (j?.url as string | undefined) || '').catch(() => '')
      .then((remote) => {
        if (remote) return remote;
        blobUrl = URL.createObjectURL(toWavBlob(synthCough(d.uuid, { tb, coughs: d.type === '-' ? 1 : d.coughs, seconds })));
        return blobUrl;
      });
    // wavesurfer dimuat di browser saja
    Promise.all([source, import('wavesurfer.js'), import('wavesurfer.js/dist/plugins/spectrogram.esm.js')]).then(([src, { default: WS }, { default: Spectrogram }]) => {
    url = src;
    if (!alive || !wave.current || !spec.current) return;
    w = WS.create({
      container: wave.current, height: 110, sampleRate: 16000, waveColor: tb ? '#f3a5a5' : '#93b4f5', progressColor: tb ? '#D32929' : '#1C3FAA',
      cursorColor: '#1e293b', barWidth: 2, barGap: 1, barRadius: 2, normalize: true, url,
      plugins: [Spectrogram.create({ container: spec.current, labels: true, scale: 'mel', fftSamples: 1024, numMelFilters: 140, height: 140, frequencyMax: 8000, colorMap: cmap as number[][], labelsBackground: 'rgba(255,255,255,.8)', labelsColor: '#475569' } as Parameters<typeof Spectrogram.create>[0])],
    });
    const ww = w;
    ww.on('play', () => setPlaying(true)); ww.on('pause', () => setPlaying(false)); ww.on('finish', () => setPlaying(false));
    ww.on('ready', (dur) => setTime(`0:00 / ${mmss(dur)}`));
    ww.on('timeupdate', (t) => setTime(`${mmss(t)} / ${mmss(ww.getDuration())}`));
    ws.current = ww;
    if (autoplayRef) autoplayRef.current = () => { if (!ww.isPlaying()) ww.play(); };
    });
    return () => { alive = false; w?.destroy(); ws.current = null; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [d.uuid]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div ref={wave} />
      <div className="my-3 flex items-center justify-center gap-3">
        <Button onClick={() => ws.current?.playPause()} className="w-28">{playing ? <PauseIcon /> : <PlayIcon />}{playing ? 'Pause' : 'Play'}</Button>
        <span className="text-muted-foreground num">{time}</span>
      </div>
      <div ref={spec} className="overflow-hidden rounded-md" />
    </div>
  );
}

/** pola beam + panah arah datang suara */
export function DoaChart({ d, dev }: { d: Detection; dev: Device }) {
  const az = d.doa.azimuth, tb = d.result === 'TB';
  const cx = 190, cy = 176, R = 140;
  const pt = (deg: number, r: number) => [cx + r * Math.sin((deg * Math.PI) / 180), cy - r * Math.cos((deg * Math.PI) / 180)];
  let lobe = '';
  for (let a = -90; a <= 90; a += 2) {
    const g = Math.exp(-Math.pow((a - az) / 16, 2)) * 0.9 + 0.08 + 0.06 * Math.abs(Math.sin(((a - az) * Math.PI) / 30)) * Math.exp(-Math.abs(a - az) / 60);
    const [x, y] = pt(a, R * Math.min(1, g));
    lobe += (lobe ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  }
  lobe += `L${cx} ${cy}Z`;
  const [ax, ay] = pt(az, R - 4), [lx, ly] = pt(az, R + 22);
  const col = tb ? '#D32929' : '#1C3FAA';
  return (
    <svg viewBox="0 0 380 206" role="img" aria-label={`Arah datang suara ${azText(az)}`} className="w-full">
      {[0.33, 0.66, 1].map((k) => <path key={k} d={`M${cx - R * k} ${cy} A${R * k} ${R * k} 0 0 1 ${cx + R * k} ${cy}`} fill="none" className="stroke-slate-200 dark:stroke-white/15" strokeDasharray={k === 1 ? undefined : '3 4'} />)}
      <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} className="stroke-slate-200 dark:stroke-white/15" />
      {[-90, -60, -30, 0, 30, 60, 90].map((a) => {
        const [x1, y1] = pt(a, R), [x2, y2] = pt(a, R + 8), [tx, ty] = pt(a, R + 22);
        return <g key={a}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" />{Math.abs(a - az) >= 14 && <text x={tx} y={ty + (Math.abs(a) === 90 ? 14 : 4)} textAnchor="middle" fontSize="10" fill="#64748b">{a}°</text>}</g>;
      })}
      <path d={lobe} fill={col} fillOpacity=".14" stroke={col} strokeWidth="1.5" />
      <defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#1e293b" /></marker></defs>
      <line x1={cx} y1={cy} x2={ax} y2={ay} stroke="#1e293b" strokeWidth="2.5" markerEnd="url(#arr)" />
      {Array.from({ length: dev.mics }, (_, i) => <circle key={i} cx={cx - (dev.mics - 1) * 5 + i * 10} cy={cy} r="3.2" fill="#1C3FAA" />)}
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize="10" fill="#64748b">mic array ({dev.mics})</text>
      <text x={lx} y={ly + 5} textAnchor="middle" fontSize="13" fontWeight="600" fill={col}>{az > 0 ? '+' : ''}{az}°</text>
    </svg>
  );
}

/** frame kamera ilustratif dengan kotak deteksi orang */
export function CameraFrame({ d, dev }: { d: Detection; dev: Device }) {
  const az = d.doa.azimuth, tb = d.result === 'TB';
  const W = 640, H = 360, fov = 78;
  const rng = { s: d.uuid.split('').reduce((a, c) => a + c.charCodeAt(0), 0) };
  const r2 = () => { rng.s = (rng.s * 16807) % 2147483647; return rng.s / 2147483647; };
  const srcX = Math.max(60, Math.min(W - 60, W / 2 + (az / (fov / 2)) * (W / 2)));
  const people: { x: number; s: number; src: boolean; conf: number }[] = [];
  for (let i = 0; i < d.person.crowd; i++) {
    let x = 0, tries = 0;
    do { x = 40 + r2() * (W - 80); tries++; } while (tries < 30 && (Math.abs(x - srcX) < 70 || people.some((p) => Math.abs(p.x - x) < 46)));
    people.push({ x, s: 0.62 + r2() * 0.4, src: false, conf: 0.6 + r2() * 0.3 });
  }
  if (d.person.tracked) people.push({ x: srcX, s: 0.95, src: true, conf: d.person.score });
  people.sort((a, b) => a.s - b.s);
  const boxC = tb ? '#ff6b6b' : '#FBC500';
  const t = new Date(d.time), p2 = (n: number) => String(n).padStart(2, '0');
  const stamp = `${p2(t.getDate())}-${p2(t.getMonth() + 1)}-${t.getFullYear()} ${p2(t.getHours())}:${p2(t.getMinutes())}:${p2(t.getSeconds())}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Frame kamera dengan kotak deteksi orang" className="block w-full">
      <rect width={W} height={H} fill="#1b2540" /><rect width={W} height="190" fill="#222e4f" />
      {[60, 210, 360, 510].map((x) => <g key={x}><rect x={x} y="34" width="110" height="88" rx="4" fill="#2c3a63" /><line x1={x + 55} y1="34" x2={x + 55} y2="122" stroke="#222e4f" strokeWidth="3" /></g>)}
      <rect y="190" width={W} height="170" fill="#172038" />
      {[30, 250, 470].map((x) => <g key={x} fill="#24304f"><rect x={x} y="262" width="150" height="14" rx="4" /><rect x={x + 8} y="276" width="6" height="30" /><rect x={x + 136} y="276" width="6" height="30" /></g>)}
      {people.map((p, i) => {
        const h = 210 * p.s, w = 74 * p.s, base = 300 + (p.s - 0.8) * 70, top = base - h, fill = p.src ? '#4c64a8' : '#3a4a78';
        const lblX = Math.max(6, Math.min(W - 176, p.x - w / 2 - 8));
        return (
          <g key={i}>
            <circle cx={p.x} cy={top + 22 * p.s} r={20 * p.s} fill={fill} />
            <path d={`M${p.x - w / 2} ${base} L${p.x - w / 2} ${top + 70 * p.s} Q${p.x - w / 2} ${top + 46 * p.s} ${p.x - w / 4} ${top + 46 * p.s} L${p.x + w / 4} ${top + 46 * p.s} Q${p.x + w / 2} ${top + 46 * p.s} ${p.x + w / 2} ${top + 70 * p.s} L${p.x + w / 2} ${base} Z`} fill={fill} />
            {p.src ? <>
              <rect x={p.x - w / 2 - 8} y={top - 8} width={w + 16} height={h + 12} fill="none" stroke={boxC} strokeWidth="3" rx="3" />
              <rect x={lblX} y={top - 30} width="170" height="22" fill={boxC} rx="3" />
              <text x={lblX + 7} y={top - 14} fontSize="12" fontWeight="600" fill="#111827">Sumber batuk · {d.person.id} {p.conf.toFixed(2)}</text>
            </> : <>
              <rect x={p.x - w / 2 - 6} y={top - 6} width={w + 12} height={h + 8} fill="none" stroke="#93b4f5" strokeOpacity=".55" strokeWidth="1.5" rx="2" />
              <text x={p.x - w / 2 - 4} y={top - 10} fontSize="10" fill="#93b4f5" fillOpacity=".85">person {p.conf.toFixed(2)}</text>
            </>}
          </g>
        );
      })}
      <line x1={srcX} y1="0" x2={srcX} y2={H} stroke="#FBC500" strokeWidth="1.5" strokeDasharray="6 6" opacity=".85" />
      <text x={srcX + 6} y={H - 12} fontSize="11" fill="#FBC500">DoA {az > 0 ? '+' : ''}{az}°</text>
      <rect x="10" y="10" width="232" height="24" rx="4" fill="rgba(0,0,0,.45)" />
      <circle cx="24" cy="22" r="5" fill="#ff5b5b" />
      <text x="36" y="27" fontSize="12" fill="#e2e8f0" fontFamily="ui-monospace, Consolas, monospace">CAM {dev.id} · {stamp}</text>
      {!d.person.tracked && <g><rect x={W / 2 - 170} y={H / 2 - 22} width="340" height="44" rx="8" fill="rgba(0,0,0,.6)" /><text x={W / 2} y={H / 2 + 5} textAnchor="middle" fontSize="14" fill="#fff">Sumber suara di luar jangkauan kamera</text></g>}
    </svg>
  );
}
