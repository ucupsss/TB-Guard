/* Estimasi arah datang suara (Direction of Arrival) untuk batuk.
   - GCC-PHAT: korelasi silang yang spektrumnya dinormalisasi (hanya fase) → selisih waktu tiba (TDOA) antar-mic,
     tahan gema & bising karena puncaknya tajam tidak bergantung pada warna spektrum suara.
   - SRP-PHAT (inverse beamforming): menyapu semua sudut, menjumlahkan GCC-PHAT semua pasangan mic pada TDOA
     yang diharapkan untuk sudut itu; sudut dengan respons terbesar = arah sumber.
   - Delay-and-sum beamforming: menyejajarkan & merata-rata kanal ke arah sumber untuk menaikkan SNR.
   Dipakai di halaman uji suara: pada 2 mic laptop (bila driver memberi kanal stereo asli) dan pada simulasi
   mic array TB Guard yang diberi rekaman batuk asli. */

export const SOUND_SPEED = 343; // m/s

/* ---------- FFT radix-2 in-place ---------- */
export function nextPow2(n: number) { let p = 1; while (p < n) p <<= 1; return p; }

function fft(re: Float64Array, im: Float64Array, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

function spectrum(x: ArrayLike<number>, n: number) {
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < Math.min(n, x.length); i++) re[i] = x[i];
  fft(re, im);
  return { re, im };
}

/** cross-spectrum ber-bobot PHAT: A·conj(B)/|A·conj(B)|, hanya pada pita frekuensi [lo, hi] Hz */
function phatCross(A: { re: Float64Array; im: Float64Array }, B: { re: Float64Array; im: Float64Array }, fs: number, lo = 150, hi = 7000) {
  const n = A.re.length, re = new Float64Array(n), im = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const f = (k <= n / 2 ? k : n - k) * fs / n;
    if (f < lo || f > hi) continue;
    const r = A.re[k] * B.re[k] + A.im[k] * B.im[k], i = A.im[k] * B.re[k] - A.re[k] * B.im[k];
    const m = Math.hypot(r, i) + 1e-12;
    re[k] = r / m; im[k] = i / m;
  }
  return { re, im };
}

export interface Gcc { /** detik; positif = sinyal a tiba lebih lambat dari b */ tau: number; peak: number; curve: { lagMs: number; v: number }[] }

/** GCC-PHAT antara dua kanal, mencari puncak dalam ±maxTau detik dengan interpolasi parabola sub-sampel */
export function gccPhat(a: ArrayLike<number>, b: ArrayLike<number>, fs: number, maxTau: number): Gcc {
  const n = nextPow2(a.length + b.length);
  const R = phatCross(spectrum(a, n), spectrum(b, n), fs);
  fft(R.re, R.im, true);
  const maxLag = Math.max(1, Math.ceil(maxTau * fs));
  const at = (l: number) => R.re[(l + n) % n];
  let best = 0;
  for (let l = -maxLag; l <= maxLag; l++) if (at(l) > at(best)) best = l;
  const y0 = at(best - 1), y1 = at(best), y2 = at(best + 1), den = y0 - 2 * y1 + y2;
  const frac = Math.abs(den) > 1e-12 ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / den)) : 0;
  const curve = [];
  for (let l = -maxLag; l <= maxLag; l++) curve.push({ lagMs: +((l / fs) * 1000).toFixed(3), v: Math.max(0, at(l)) });
  return { tau: (best + frac) / fs, peak: Math.max(0, Math.min(1, y1)), curve };
}

/** tunda sinyal sebanyak `d` sampel (boleh pecahan/negatif) lewat domain frekuensi; panjang keluaran = n */
function delayed(x: ArrayLike<number>, d: number, n: number) {
  const { re, im } = spectrum(x, n);
  for (let k = 0; k < n; k++) {
    const kk = k <= n / 2 ? k : k - n, ph = (-2 * Math.PI * kk * d) / n;
    const c = Math.cos(ph), s = Math.sin(ph), r = re[k] * c - im[k] * s;
    im[k] = re[k] * s + im[k] * c; re[k] = r;
  }
  fft(re, im, true);
  return re;
}

const power = (x: ArrayLike<number>, from = 0, to = x.length) => {
  let s = 0; for (let i = from; i < to; i++) s += x[i] * x[i];
  return s / Math.max(1, to - from);
};
const db = (p: number) => 10 * Math.log10(Math.max(p, 1e-20));

/** onset batuk: jendela 20 ms pertama yang energinya ≥ 35% puncak (sampel) */
export function onsetSample(x: ArrayLike<number>, fs: number) {
  const win = Math.round(fs * 0.02);
  let max = 0; const e: number[] = [];
  for (let i = 0; i + win <= x.length; i += win) { const p = power(x, i, i + win); e.push(p); max = Math.max(max, p); }
  return Math.max(0, e.findIndex((v) => v >= max * 0.35)) * win;
}

/* ================= 2 mic laptop (stereo asli) ================= */

export interface RawCapture { fs: number; channels: Float32Array[]; reportedChannels?: number }
export interface StereoDoa {
  ok: boolean;
  /** alasan bila tidak bisa dihitung */
  reason?: string;
  /** derajat; positif = ke arah kanan tampilan kamera (mirror) */
  azimuth: number;
  tauUs: number; confidence: number; curve: Gcc['curve'];
  snrMicDb: number; snrBeamDb: number;
}

/** GCC-PHAT pada 2 mic laptop. spacing = jarak antar-mic (m); swap = tukar kanal kiri/kanan */
export function analyzeStereo(raw: RawCapture, spacing: number, swap: boolean): StereoDoa {
  const empty = { azimuth: 0, tauUs: 0, confidence: 0, curve: [], snrMicDb: 0, snrBeamDb: 0 };
  const [c0, c1] = raw.channels;
  if (!c0 || !c1 || c0.length < raw.fs * 0.3) return { ok: false, reason: 'Browser hanya memberi 1 kanal audio dari mic laptop.', ...empty };
  const diff = Math.sqrt(power(c0.map((v, i) => v - c1[i]))) / (Math.sqrt(power(c0)) + 1e-12);
  if (power(c1) < 1e-10) return { ok: false, reason: 'Kanal kedua kosong: mic laptop terbaca mono.', ...empty };
  if (diff < 0.02) return { ok: false, reason: 'Kedua kanal identik: driver laptop menggabungkan mic menjadi mono (biasanya karena peredam bising bawaan).', ...empty };

  const [L, R] = swap ? [c1, c0] : [c0, c1];
  const on = onsetSample(L, raw.fs);
  const from = Math.max(0, on - Math.round(raw.fs * 0.05)), to = Math.min(L.length, on + Math.round(raw.fs * 0.35));
  const a = L.subarray(from, to), b = R.subarray(from, to);
  const maxTau = spacing / SOUND_SPEED;
  // tau > 0: kanal kiri tiba lebih lambat → sumber lebih dekat ke mic kanan
  const g = gccPhat(a, b, raw.fs, maxTau * 1.1);
  const azimuth = (Math.asin(Math.max(-1, Math.min(1, (g.tau * SOUND_SPEED) / spacing))) * 180) / Math.PI;

  // SNR: segmen batuk vs segmen bising sebelum batuk, untuk 1 mic dan hasil delay-and-sum
  const n = nextPow2(L.length);
  const Rs = delayed(R, g.tau * raw.fs, n), beam = new Float64Array(L.length);
  for (let i = 0; i < L.length; i++) beam[i] = (L[i] + Rs[i]) / 2;
  const noiseTo = Math.max(Math.round(raw.fs * 0.1), from - Math.round(raw.fs * 0.05));
  const snr = (x: ArrayLike<number>) => db(power(x, from, to)) - db(power(x, 0, noiseTo));
  return { ok: true, azimuth, tauUs: g.tau * 1e6, confidence: g.peak, curve: g.curve, snrMicDb: snr(L), snrBeamDb: snr(beam) };
}

/* ================= simulasi mic array TB Guard ================= */

export interface Mic { x: number; y: number }
/** ReSpeaker USB Mic Array v2.0: 4 mic melingkar, radius 32 mm */
export const RESPEAKER_4: Mic[] = [0, 90, 180, 270].map((d) => ({ x: 0.032 * Math.cos((d * Math.PI) / 180), y: 0.032 * Math.sin((d * Math.PI) / 180) }));

/** waktu tiba relatif pusat array untuk sumber jauh di sudut az (derajat) */
const arrival = (m: Mic, az: number) => -(m.x * Math.cos((az * Math.PI) / 180) + m.y * Math.sin((az * Math.PI) / 180)) / SOUND_SPEED;

function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
function gauss(r: () => number) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); }

export interface SimOptions { az: number; snrDb: number; interferer: { az: number; sirDb: number } | null; seed?: number }
export interface SimResult {
  estAz: number; errDeg: number;
  srp: { az: number; v: number }[];
  pairs: { label: string; trueUs: number; estUs: number }[];
  snrMicDb: number; snrBeamDb: number;
  fs: number; noisyMic: Float32Array; beamOut: Float32Array;
}

/**
 * Letakkan rekaman batuk mono di sudut `az` terhadap array virtual, tambahkan bising sensor (SNR) dan
 * opsional sumber bising terarah, lalu estimasi sudutnya kembali dengan SRP-PHAT dan beamforming ke sana.
 */
export function simulateArray(mono: Float32Array, fs: number, o: SimOptions, mics: Mic[] = RESPEAKER_4): SimResult {
  const on = onsetSample(mono, fs);
  const from = Math.max(0, on - Math.round(fs * 0.25)), len = Math.min(mono.length - from, Math.round(fs * 0.75));
  const clip = mono.subarray(from, from + len);
  const sigFrom = on - from, sigTo = Math.min(len, sigFrom + Math.round(fs * 0.35));
  const n = nextPow2(len + 64), r = rng(o.seed ?? 7);

  // sinyal bersih di tiap mic
  const clean = mics.map((m) => delayed(clip, arrival(m, o.az) * fs, n).subarray(0, len));
  const sigPow = power(clean[0], sigFrom, sigTo);
  // bising terarah (pink kasar: white yang di-lowpass) dari sudut lain
  let inter: Float64Array[] | null = null;
  if (o.interferer) {
    const w = new Float64Array(len); let lp = 0;
    for (let i = 0; i < len; i++) { lp = 0.92 * lp + 0.08 * gauss(r); w[i] = lp; }
    const k = Math.sqrt(sigPow / (power(w) * 10 ** (o.interferer.sirDb / 10)));
    inter = mics.map((m) => delayed(w.map((v) => v * k), arrival(m, o.interferer!.az) * fs, n).subarray(0, len));
  }
  const sensorStd = Math.sqrt(sigPow / 10 ** (o.snrDb / 10));
  const noise = mics.map((_, mi) => Float64Array.from({ length: len }, (_, i) => sensorStd * gauss(r) + (inter ? inter[mi][i] : 0)));
  const noisy = mics.map((_, mi) => clean[mi].map((v, i) => v + noise[mi][i]));

  // SRP-PHAT: jumlah respons GCC-PHAT semua pasangan pada TDOA tiap sudut kandidat
  const S = noisy.map((x) => spectrum(x, n));
  const pairsIdx: [number, number][] = [];
  for (let i = 0; i < mics.length; i++) for (let j = i + 1; j < mics.length; j++) pairsIdx.push([i, j]);
  const crosses = pairsIdx.map(([i, j]) => phatCross(S[i], S[j], fs));
  const kMax = Math.floor((7000 * n) / fs), kMin = Math.ceil((150 * n) / fs);
  const srp: { az: number; v: number }[] = [];
  for (let az = 0; az < 360; az += 2) {
    let v = 0;
    pairsIdx.forEach(([i, j], p) => {
      // G_ij(k)·e^{+jωτ} dengan τ = t_i − t_j, dihitung lewat rotasi berulang (tanpa trig per bin)
      const tau = arrival(mics[i], az) - arrival(mics[j], az), step = (2 * Math.PI * tau * fs) / n;
      const sr = Math.cos(step), si = Math.sin(step), C = crosses[p];
      let cr = Math.cos(step * kMin), ci = Math.sin(step * kMin);
      for (let k = kMin; k <= kMax; k++) {
        v += C.re[k] * cr - C.im[k] * ci;
        const t = cr * sr - ci * si; ci = cr * si + ci * sr; cr = t;
      }
    });
    srp.push({ az, v });
  }
  const lo = Math.min(...srp.map((s) => s.v)), hi = Math.max(...srp.map((s) => s.v));
  srp.forEach((s) => { s.v = (s.v - lo) / (hi - lo || 1); });
  // haluskan puncak dengan parabola antar-grid
  const bi = srp.reduce((b, s, i) => (s.v > srp[b].v ? i : b), 0);
  const y0 = srp[(bi + srp.length - 1) % srp.length].v, y1 = srp[bi].v, y2 = srp[(bi + 1) % srp.length].v, den = y0 - 2 * y1 + y2;
  const estAz = (srp[bi].az + (Math.abs(den) > 1e-9 ? (0.5 * (y0 - y2) / den) * 2 : 0) + 360) % 360;
  const errDeg = Math.abs(((estAz - o.az + 540) % 360) - 180);

  // GCC-PHAT pasangan mic 1 terhadap yang lain (untuk tabel TDOA)
  const maxTau = 0.07 / SOUND_SPEED;
  const pairs = [1, 2, 3].map((j) => ({
    label: `m1–m${j + 1}`,
    trueUs: (arrival(mics[0], o.az) - arrival(mics[j], o.az)) * 1e6,
    estUs: gccPhat(noisy[0], noisy[j], fs, maxTau).tau * 1e6,
  }));

  // delay-and-sum ke sudut estimasi; dihitung terpisah untuk komponen bersih & bising (linear) → SNR pasti
  const steer = (xs: ArrayLike<number>[]) => {
    const out = new Float64Array(len);
    xs.forEach((x, mi) => { const y = delayed(x, -arrival(mics[mi], estAz) * fs, n); for (let i = 0; i < len; i++) out[i] += y[i] / mics.length; });
    return out;
  };
  const bClean = steer(clean), bNoise = steer(noise), beam = steer(noisy);
  return {
    estAz, errDeg, srp, pairs, fs,
    snrMicDb: db(power(clean[0], sigFrom, sigTo)) - db(power(noise[0], sigFrom, sigTo)),
    snrBeamDb: db(power(bClean, sigFrom, sigTo)) - db(power(bNoise, sigFrom, sigTo)),
    noisyMic: Float32Array.from(noisy[0]), beamOut: Float32Array.from(beam),
  };
}
