// Musik latar sintetis (bebas hak cipta) untuk video iklan: pad ambient + denyut bass + arpeggio + whoosh yang mengikuti
// animasi "Separation & reassembly" (terpisah 1-6 dtk, kembali 6-11 dtk) + bunyi "klik" saat terpasang kembali.
// Pakai:  node scripts/make-audio.mjs <video-masuk.mp4> <video-keluar.mp4>
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const [,, input, output] = process.argv;
if (!input || !output) { console.error('pakai: node scripts/make-audio.mjs in.mp4 out.mp4'); process.exit(1); }
const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', input], { encoding: 'utf8' });
const DUR = Number(probe.stdout.trim());
const SR = 44100, N = Math.floor(DUR * SR);
const L = new Float32Array(N), R = new Float32Array(N);
const TAU = Math.PI * 2;
let seed = 1234567;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
const add = (i, l, r) => { if (i >= 0 && i < N) { L[i] += l; R[i] += r; } };

// 1) Pad: Am -> F -> C -> G, tiap akor 3 dtk, dua osilator sedikit detune + LFO halus
const chords = [[57, 60, 64], [53, 57, 60], [48, 55, 60], [55, 59, 62]];
for (let i = 0; i < N; i++) {
  const t = i / SR, c = chords[Math.min(3, Math.floor(t / 3))], lt = (t % 3) / 3;
  const env = Math.min(1, lt * 6) * Math.min(1, (1 - lt) * 6 + 0.35);
  let s = 0;
  for (const n of c) s += Math.sin(TAU * hz(n) * t) + 0.6 * Math.sin(TAU * hz(n) * 1.004 * t + 1.3) + 0.25 * Math.sin(TAU * hz(n + 12) * t);
  s *= 0.035 * env * (0.85 + 0.15 * Math.sin(TAU * 0.35 * t));
  add(i, s, s * 0.95);
}

// 2) Kick lembut 120 bpm (mulai 0,5 dtk), sidechain halus pada pad lewat envelope sederhana
for (let b = 0; b * 0.5 + 0.5 < DUR; b++) {
  const t0 = 0.5 + b * 0.5, start = Math.floor(t0 * SR);
  for (let k = 0; k < SR * 0.28; k++) {
    const t = k / SR, f = 48 + 90 * Math.exp(-t * 26), a = Math.exp(-t * 9);
    const v = Math.sin(TAU * f * t) * a * 0.42;
    add(start + k, v, v);
  }
}

// 3) Arpeggio pentatonik A minor, 8th notes, bergantian kiri-kanan
const penta = [69, 72, 74, 76, 79, 76, 74, 72];
for (let s = 0; s * 0.25 < DUR - 0.1; s++) {
  const t0 = s * 0.25, start = Math.floor(t0 * SR), f = hz(penta[s % 8] + (Math.floor(t0 / 3) % 2 ? -5 : 0));
  const pan = s % 2 ? 0.7 : 0.3, vol = t0 < 0.9 ? 0.02 : 0.06;
  for (let k = 0; k < SR * 0.22; k++) {
    const t = k / SR, a = Math.exp(-t * 16) * Math.min(1, t * 400);
    const v = (Math.sin(TAU * f * t) + 0.4 * Math.sin(TAU * f * 2 * t)) * a * vol;
    add(start + k, v * (1 - pan) * 1.6, v * pan * 1.6);
  }
}

// 4) Whoosh: derau tersaring yang naik saat komponen memisah dan turun saat kembali
function whoosh(t0, len, up, vol) {
  let low = 0, band = 0;
  const start = Math.floor(t0 * SR);
  for (let k = 0; k < len * SR; k++) {
    const p = k / (len * SR), env = Math.sin(Math.PI * p) ** 1.5;
    const fc = (up ? 300 + 5200 * p * p : 5500 - 5200 * p) / SR * 2 * Math.PI;
    const f = 2 * Math.sin(Math.min(0.9, fc / 2)), q = 0.55;
    low += f * band; const high = rnd() - low - q * band; band += f * high;
    const v = band * env * vol, pan = 0.5 + 0.4 * Math.sin(TAU * p * (up ? 1 : -1) * 0.5);
    add(start + k, v * (1 - pan) * 1.4, v * pan * 1.4);
  }
}
whoosh(0.9, 4.6, true, 0.23);
whoosh(6.4, 4.6, false, 0.23);

// 5) Klik/chime saat terpasang kembali + riser pendek sebelum itu
const lock = Math.min(DUR - 0.5, 11.4), ls = Math.floor(lock * SR);
for (let k = 0; k < SR * 0.6; k++) {
  const t = k / SR, a = Math.exp(-t * 7);
  const v = (Math.sin(TAU * hz(84) * t) + 0.5 * Math.sin(TAU * hz(91) * t)) * a * 0.1 + (k < 300 ? rnd() * 0.25 * (1 - k / 300) : 0);
  add(ls + k, v, v);
}

// 6) Master: fade in/out agar loop tidak berbunyi "klik", soft clip
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR, g = Math.min(1, t / 0.25) * Math.min(1, (DUR - t) / 0.3);
  L[i] = Math.tanh(L[i] * g * 1.15); R[i] = Math.tanh(R[i] * g * 1.15);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const scale = 0.7 / peak;
const pcm = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) { pcm.writeInt16LE(Math.round(L[i] * scale * 32767), i * 4); pcm.writeInt16LE(Math.round(R[i] * scale * 32767), i * 4 + 2); }
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(pcm.length, 40);
const wav = output.replace(/\.mp4$/, '') + '.wav';
fs.writeFileSync(wav, Buffer.concat([hdr, pcm]));

const r = spawnSync('ffmpeg', ['-y', '-i', input, '-i', wav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', output], { encoding: 'utf8' });
fs.rmSync(wav, { force: true });
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
console.log('ok', output, fs.statSync(output).size, 'bytes, durasi', DUR.toFixed(2), 's');
