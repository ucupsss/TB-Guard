'use client';

/* Pelacakan individu batuk untuk uji suara memakai kamera laptop (semua diproses di browser, tidak diunggah).
   Mic laptop tidak bisa mengukur arah suara (DoA), jadi sumber batuk diperkirakan dari WAJAH:
   saat rekaman, wajah tiap orang dideteksi ~10 fps (MediaPipe Face Landmarker + blendshape ekspresi).
   Setelah itu dicari momen onset batuk dari audio, lalu tiap wajah dinilai dari perubahan ekspresi khas batuk
   (mulut membuka mendadak, mata menyipit/terpejam, alis turun) dan sentakan kepala di sekitar momen itu,
   dibandingkan dengan ekspresi wajah itu sendiri sebelum batuk. Batuk tanpa gerakan badan tetap terbaca dari ekspresi. */
import * as React from 'react';
import type { FaceLandmarker } from '@mediapipe/tasks-vision';

const VISION_VERSION = '1.1.1'; // samakan dengan versi @mediapipe/tasks-vision di package.json
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const MAX_FACES = 6;
const FRAME_MS = 100;
const SNAP_W = 640;

interface Face { box: Box; nose: { x: number; y: number }; size: number; bs: Record<string, number> }
interface Frame { t: number; faces: Face[]; snap: ImageBitmap }
export interface Box { x: number; y: number; w: number; h: number }
export interface Candidate { box: Box; face: Box; score: number; share: number; reason: string }
export interface Attribution {
  /** gambar frame pada momen batuk */
  image: ImageBitmap;
  /** semua orang di frame, urut skor tertinggi */
  people: Candidate[];
  /** indeks orang yang diduga batuk di `people`, null bila tidak ada orang */
  source: number | null;
  ambiguous: boolean;
  /** detik onset batuk di rekaman */
  onsetSec: number;
}

/* WASM MediaPipe mencetak log informasi (mis. "INFO: Created TensorFlow Lite XNNPACK delegate for CPU",
   "I0000 …", "W0000 …") lewat console.error, sehingga overlay Next.js menganggapnya error.
   Saring hanya log berformat itu selama memanggil MediaPipe; error lain tetap diteruskan. */
const MP_LOG = /^(INFO:|WARNING:|[IW]\d{4} )/;
function quiet<T>(fn: () => T): T {
  const orig = { error: console.error, warn: console.warn, info: console.info, log: console.log };
  const filter = (f: (...a: unknown[]) => void) => (...a: unknown[]) => { if (!(typeof a[0] === 'string' && MP_LOG.test(a[0]))) f(...a); };
  console.error = filter(orig.error); console.warn = filter(orig.warn); console.info = filter(orig.info); console.log = filter(orig.log);
  const restore = () => Object.assign(console, orig);
  try {
    const r = fn();
    if (r instanceof Promise) return r.finally(restore) as T;
    restore();
    return r;
  } catch (e) { restore(); throw e; }
}

let landmarker: Promise<FaceLandmarker> | null = null;
function getLandmarker() {
  landmarker ??= (async () => {
    const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision');
    const files = await FilesetResolver.forVisionTasks(WASM_URL);
    const make = (delegate: 'GPU' | 'CPU') => quiet(() => FaceLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO', numFaces: MAX_FACES, outputFaceBlendshapes: true,
      minFaceDetectionConfidence: 0.35, minFacePresenceConfidence: 0.35, minTrackingConfidence: 0.35,
    }));
    // tidak semua laptop/browser punya WebGL yang didukung; jatuh ke CPU bila GPU gagal
    return make('GPU').catch(() => make('CPU'));
  })().catch((e) => { landmarker = null; throw e; });
  return landmarker;
}

const avg = (bs: Record<string, number>, ...k: string[]) => k.reduce((n, x) => n + (bs[x] ?? 0), 0) / k.length;
/** sinyal ekspresi batuk per frame (0..~2) */
const cue = (bs: Record<string, number>) =>
  (bs.jawOpen ?? 0) + 0.5 * avg(bs, 'mouthFunnel', 'mouthPucker') + 0.6 * avg(bs, 'eyeSquintLeft', 'eyeSquintRight')
  + 0.5 * avg(bs, 'eyeBlinkLeft', 'eyeBlinkRight') + 0.4 * avg(bs, 'browDownLeft', 'browDownRight');

/** onset batuk: jendela 20 ms pertama yang energinya ≥ 35% puncak */
export function coughOnset(buf: AudioBuffer) {
  const d = buf.getChannelData(0), win = Math.round(buf.sampleRate * 0.02);
  const e: number[] = [];
  for (let i = 0; i + win <= d.length; i += win) { let s = 0; for (let j = i; j < i + win; j++) s += d[j] * d[j]; e.push(s); }
  const max = Math.max(...e, 1e-12);
  const k = e.findIndex((v) => v >= max * 0.35);
  return (Math.max(0, k) * win) / buf.sampleRate;
}

/** cocokkan wajah antar-frame ke track (orang) memakai jarak hidung terdekat relatif ukuran wajah */
function track(frames: Frame[]) {
  const tracks: { last: Face; items: { f: number; face: Face }[] }[] = [];
  frames.forEach((fr, f) => {
    const used = new Set<number>();
    for (const face of fr.faces) {
      let best = -1, bd = Infinity;
      tracks.forEach((t, i) => {
        const d = Math.hypot(t.last.nose.x - face.nose.x, t.last.nose.y - face.nose.y);
        if (!used.has(i) && d < bd && d < Math.max(t.last.size, face.size) * 0.8) { bd = d; best = i; }
      });
      if (best < 0) { tracks.push({ last: face, items: [] }); best = tracks.length - 1; }
      used.add(best); tracks[best].last = face; tracks[best].items.push({ f, face });
    }
  });
  return tracks;
}

/** kotak badan perkiraan dari kotak wajah (kepala + bahu), dibatasi ke frame */
function bodyBox(f: Box): Box {
  const x0 = Math.max(0, f.x - f.w * 0.55), x1 = Math.min(1, f.x + f.w * 1.55);
  const y0 = Math.max(0, f.y - f.h * 0.3), y1 = Math.min(1, f.y + f.h * 2.2);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function attribute(frames: Frame[], onsetMs: number): Omit<Attribution, 'onsetSec'> | null {
  if (!frames.length) return null;
  const near = (t: number) => frames.reduce((b, fr, i) => (Math.abs(fr.t - t) < Math.abs(frames[b].t - t) ? i : b), 0);
  // frame yang ditampilkan: sedikit sebelum onset, saat wajah belum tertutup tangan
  const ref = near(onsetMs - 100);
  const inWin = (t: number) => t >= onsetMs - 400 && t <= onsetMs + 800;

  const scored = track(frames).filter((t) => t.items.some((it) => inWin(frames[it.f].t))).map((t) => {
    const before = t.items.filter((it) => frames[it.f].t < onsetMs - 400).map((it) => cue(it.face.bs)).sort((a, b) => a - b);
    const win = t.items.filter((it) => inWin(frames[it.f].t));
    // baseline: ekspresi wajah itu sendiri sebelum batuk (median), atau nilai terendah di jendela bila batuk di awal rekaman
    const base = before.length ? before[Math.floor(before.length / 2)] : Math.min(...win.map((it) => cue(it.face.bs)));
    const expr = Math.max(0, Math.max(...win.map((it) => cue(it.face.bs))) - base);
    let jerk = 0;
    for (let i = 1; i < win.length; i++) {
      const a = win[i - 1].face, b = win[i].face;
      jerk = Math.max(jerk, Math.hypot(a.nose.x - b.nose.x, a.nose.y - b.nose.y) / b.size);
    }
    const head = Math.min(1, jerk * 2.5);
    // kotak diambil dari frame acuan bila wajah ada di sana, selain itu frame terdekat
    const at = t.items.reduce((b, it) => (Math.abs(frames[it.f].t - frames[ref].t) < Math.abs(frames[b.f].t - frames[ref].t) ? it : b));
    const reason = expr >= head
      ? 'Ekspresi khas batuk (mulut membuka mendadak, mata menyipit) paling kuat saat batuk.'
      : 'Sentakan kepala paling kuat saat batuk.';
    return { face: at.face.box, box: bodyBox(at.face.box), score: expr + 0.6 * head + 0.03, reason };
  });
  const total = scored.reduce((n, c) => n + c.score, 0) || 1;
  const people = scored.map((c) => ({ ...c, share: c.score / total })).sort((a, b) => b.score - a.score);
  const ambiguous = people.length > 1 && people[0].score < people[1].score * 1.5;
  return { image: frames[ref].snap, people, source: people.length ? 0 : null, ambiguous };
}

/** sudut horizontal kamera laptop (perkiraan umum webcam bawaan) */
export const CAM_FOV = 70;
/** sudut (derajat, positif = kanan tampilan mirror) ↔ posisi x tampilan 0..1 */
export const azToX = (az: number, fov = CAM_FOV) => 0.5 + Math.tan((az * Math.PI) / 180) / (2 * Math.tan((fov * Math.PI) / 360));
const xToAz = (x: number, fov = CAM_FOV) => (Math.atan((x - 0.5) * 2 * Math.tan((fov * Math.PI) / 360)) * 180) / Math.PI;

/**
 * Gabungkan arah suara (DoA) dengan skor ekspresi wajah: wajah yang searah suara diberi bobot lebih.
 * Bobot tidak pernah nol supaya DoA yang meleset tidak sepenuhnya menghapus bukti dari wajah.
 */
export function fuseDoa(att: Attribution, az: number, sigma = 15): Attribution {
  if (!att.people.length) return att;
  const people = att.people.map((p) => {
    const xd = 1 - (p.face.x + p.face.w / 2); // kotak dalam koordinat kamera mentah, tampilan di-mirror
    const off = xToAz(xd) - az, w = 0.2 + 0.8 * Math.exp(-((off / sigma) ** 2));
    return { ...p, score: p.score * w, reason: Math.abs(off) <= sigma ? `${p.reason} Searah dengan arah suara (selisih ${Math.abs(off).toFixed(0)}°).` : p.reason };
  });
  const total = people.reduce((n, p) => n + p.score, 0) || 1;
  const sorted = people.map((p) => ({ ...p, share: p.score / total })).sort((a, b) => b.score - a.score);
  return { ...att, people: sorted, source: 0, ambiguous: sorted.length > 1 && sorted[0].score < sorted[1].score * 1.5 };
}

export type CamState = 'off' | 'starting' | 'loading-model' | 'ready' | 'error';

/** kamera laptop + perekam wajah. begin() saat mulai rekam audio, finish(audio) setelah selesai.
    autoStart: nyalakan kamera begitu komponen dipasang (browser tetap meminta izin pertama kali). */
export function useCoughCamera({ autoStart = false }: { autoStart?: boolean } = {}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const stream = React.useRef<MediaStream | null>(null);
  const model = React.useRef<FaceLandmarker | null>(null);
  const frames = React.useRef<Frame[]>([]);
  const timer = React.useRef<number | null>(null);
  const t0 = React.useRef(0);
  const gen = React.useRef(0); // naik tiap begin/stop supaya frame async yang telat dibuang
  const session = React.useRef(0); // naik tiap start/stop supaya start yang tertunda tidak menyalakan kamera setelah dimatikan
  const [state, setState] = React.useState<CamState>('off');
  const [error, setError] = React.useState('');

  const stopLoop = () => { gen.current++; if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  const dropFrames = (keep?: ImageBitmap) => { frames.current.forEach((f) => f.snap !== keep && f.snap.close()); frames.current = []; };

  const stop = React.useCallback(() => {
    session.current++;
    stopLoop(); dropFrames();
    stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState('off');
  }, []);
  const start = React.useCallback(async () => {
    const id = ++session.current;
    setError(''); setState('starting');
    let s: MediaStream | null = null;
    try {
      s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
      if (id !== session.current) { s.getTracks().forEach((t) => t.stop()); return; } // sudah dimatikan/di-unmount
      stream.current = s;
      if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play().catch(() => {}); }
      setState('loading-model');
      model.current = await getLandmarker();
      if (id !== session.current) return;
      setState('ready');
    } catch (e) {
      s?.getTracks().forEach((t) => t.stop());
      if (id !== session.current) return;
      stream.current = null;
      setError(e instanceof DOMException && e.name === 'NotAllowedError' ? 'Akses kamera ditolak. Izinkan kamera di pengaturan browser.' : 'Kamera atau model deteksi tidak bisa dimuat. Periksa koneksi internet.');
      setState('error');
    }
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- menyalakan kamera = sinkronisasi dengan perangkat eksternal
    if (autoStart) void start();
    return stop;
  }, [autoStart, start, stop]);

  /** mulai mengambil frame + wajah; waktu 0 disamakan dengan mulainya rekaman audio */
  const begin = () => {
    const v = videoRef.current, m = model.current;
    stopLoop(); dropFrames();
    if (state !== 'ready' || !v || !m) return;
    t0.current = performance.now();
    const g = gen.current;
    timer.current = window.setInterval(async () => {
      if (v.readyState < 2) return;
      const now = performance.now();
      const res = quiet(() => m.detectForVideo(v, now));
      const faces: Face[] = res.faceLandmarks.map((lm, i) => {
        let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
        for (const p of lm) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
        const bs: Record<string, number> = {};
        for (const c of res.faceBlendshapes[i]?.categories ?? []) bs[c.categoryName] = c.score;
        return { box: { x: Math.max(0, x0), y: Math.max(0, y0), w: Math.min(1, x1) - Math.max(0, x0), h: Math.min(1, y1) - Math.max(0, y0) },
          nose: { x: lm[1].x, y: lm[1].y }, size: Math.max(0.03, x1 - x0), bs };
      });
      const h = Math.round((SNAP_W * v.videoHeight) / v.videoWidth);
      const snap = await createImageBitmap(v, { resizeWidth: SNAP_W, resizeHeight: h });
      if (g !== gen.current) { snap.close(); return; }
      frames.current.push({ t: now - t0.current, faces, snap });
    }, FRAME_MS);
  };

  /** hentikan pengambilan frame lalu tentukan siapa yang batuk berdasarkan onset di audio */
  const finish = (audio: AudioBuffer | null): Attribution | null => {
    stopLoop();
    if (!audio || !frames.current.length) { dropFrames(); return null; }
    const onsetSec = coughOnset(audio);
    const r = attribute(frames.current, onsetSec * 1000);
    dropFrames(r?.image);
    return r && { ...r, onsetSec };
  };

  return { videoRef, state, error, start, stop, begin, finish };
}
