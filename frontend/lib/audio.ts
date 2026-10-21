/* Generator suara batuk SINTETIS (hanya untuk demo tampilan).
   Saat backend siap, ganti dengan URL rekaman asli, mis. /api/recordings/<uuid>.wav */
function seeded(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6d2b79f5; let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addCough(buf: Float32Array, sr: number, start: number, rnd: () => number, tb: boolean) {
  const dur = tb ? 0.38 + rnd() * 0.22 : 0.22 + rnd() * 0.12;
  const n = Math.floor(dur * sr);
  const f0 = 160 + rnd() * 140;
  let lp = 0, lp2 = 0;
  const cutoff = tb ? 0.55 : 0.28;
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const t = i / sr;
    const env = (1 - Math.exp(-t / 0.004)) * Math.exp(-t / (dur * (tb ? 0.42 : 0.3)));
    const white = rnd() * 2 - 1;
    lp += cutoff * (white - lp);
    lp2 += 0.08 * (white - lp2);
    const rough = tb ? 0.6 + 0.4 * Math.sin(2 * Math.PI * (28 + rnd() * 4) * t) : 1;
    const voiced = Math.sin(2 * Math.PI * f0 * t) * 0.35 * Math.exp(-t / 0.12) + Math.sin(2 * Math.PI * f0 * 2.02 * t) * 0.12;
    const s = (lp * 0.9 + lp2 * 0.6) * rough + voiced * (t > 0.03 ? 0.6 : 0.1);
    buf[start + i] += s * env * (0.65 + rnd() * 0.35);
  }
  return n;
}

export function synthCough(uuid: string, { tb = false, coughs = 3, seconds = 6, sr = 16000 } = {}) {
  const rnd = seeded(uuid || 'tbv');
  const len = Math.floor(seconds * sr);
  const buf = new Float32Array(len);
  for (let i = 0; i < len; i++) buf[i] = (rnd() * 2 - 1) * 0.012 + Math.sin((2 * Math.PI * 50 * i) / sr) * 0.004;
  let pos = Math.floor(0.25 * sr);
  for (let c = 0; c < coughs && pos < len - sr * 0.3; c++) {
    const used = addCough(buf, sr, pos, rnd, tb);
    const gap = c % 3 === 2 ? 0.55 + rnd() * 0.4 : 0.12 + rnd() * 0.25;
    pos += used + Math.floor(gap * sr);
  }
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(buf[i]));
  const g = peak ? 0.92 / peak : 1;
  for (let i = 0; i < len; i++) buf[i] *= g;
  return { samples: buf, sampleRate: sr };
}

export function toWavBlob({ samples, sampleRate }: { samples: Float32Array; sampleRate: number }) {
  const n = samples.length;
  const ab = new ArrayBuffer(44 + n * 2);
  const v = new DataView(ab);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE');
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, samples[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  return new Blob([ab], { type: 'audio/wav' });
}

/** Amplop kasar untuk thumbnail waveform kecil (tanpa wavesurfer). */
export function envelope(uuid: string, tb: boolean, coughs: number, bins = 40) {
  const { samples } = synthCough(uuid, { tb, coughs, seconds: tb ? 7 : 5, sr: 4000 });
  const step = Math.floor(samples.length / bins);
  return Array.from({ length: bins }, (_, i) => {
    let m = 0; for (let j = i * step; j < (i + 1) * step; j++) m = Math.max(m, Math.abs(samples[j]));
    return m;
  });
}
