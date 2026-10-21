/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — data contoh dipindah apa adanya dari versi HTML (data.js) supaya angkanya sama.
/* MOCK DATA: pengganti API backend selama tahap frontend. Semua nama orang fiktif.
   Nanti cukup ganti fungsi di src/lib/store.tsx dengan fetch() ke Express. */
import type { Device, Detection, Patient, WebformRow, OfflineRow, PrimerRow } from './types';

// RNG ber-seed agar data sama setiap reload
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(2030);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => a + rnd() * (b - a);
const uid = () => {
  const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = 'mg';
  for (let i = 0; i < 6; i++) s += c[Math.floor(rnd() * c.length)];
  return s;
};

// "Sekarang" dibuat tetap supaya grafik selalu terisi
const NOW = new Date('2025-10-20T16:00:00+07:00');
const DAY = 86400000;

const devices = [
  { id: 400, name: 'TB Guard 1', type: 'cough', status: 'active', location: 'Stasiun Gubeng', zone: 'Antrian – Ruang Tunggu Utama', city: 'Surabaya',
    mics: 4, array: 'ReSpeaker 4-Mic Circular', camera: 'USB Cam 1080p (FOV 78°)', fw: 'v1.3.2', installed: '2025-09-28', lastSeen: NOW.getTime() - 2 * 60000, lat: -7.2652, lng: 112.7522 },
  { id: 401, name: 'TB Guard 2', type: 'cough', status: 'active', location: 'RSKI Universitas Airlangga', zone: 'Poli Paru – Ruang Tunggu', city: 'Surabaya',
    mics: 4, array: 'ReSpeaker 4-Mic Circular', camera: 'USB Cam 1080p (FOV 78°)', fw: 'v1.3.2', installed: '2025-10-03', lastSeen: NOW.getTime() - 6 * 60000, lat: -7.2701, lng: 112.7849 },
  { id: 402, name: 'TB Guard 3', type: 'cough', status: 'inactive', location: 'Stasiun Gubeng', zone: 'Peron 2', city: 'Surabaya',
    mics: 4, array: 'ReSpeaker 4-Mic Circular', camera: 'USB Cam 720p (FOV 90°)', fw: 'v1.2.9', installed: '2025-10-10', lastSeen: NOW.getTime() - 26 * 3600000, lat: -7.2649, lng: 112.7529 },
  { id: 403, name: 'TB Guard 4', type: 'cough', status: 'broken', location: 'Lab Pengembangan', zone: 'Unit Uji', city: 'Surabaya',
    mics: 6, array: 'Linear 6-Mic Array', camera: '—', fw: 'v1.4.0-beta', installed: '2025-10-15', lastSeen: NOW.getTime() - 4 * DAY, lat: -7.2797, lng: 112.7975 }
];

const firstNames = ['Agus', 'Siti', 'Budi', 'Dewi', 'Rizky', 'Nur', 'Eko', 'Lina', 'Hendra', 'Ayu', 'Fajar', 'Rina', 'Joko', 'Wulan', 'Dimas', 'Putri', 'Yusuf', 'Indah', 'Bayu', 'Sari'];
const lastNames = ['Santoso', 'Rahmawati', 'Prasetyo', 'Lestari', 'Hidayat', 'Wijaya', 'Kurniawan', 'Pertiwi', 'Saputra', 'Handayani', 'Nugroho', 'Maharani'];
const personName = () => pick(firstNames) + ' ' + pick(lastNames);

// ---------- Deteksi batuk dari perangkat ----------
const detections = [];
const perDevice = { 400: 62, 401: 41, 402: 14, 403: 3 };
Object.entries(perDevice).forEach(([devId, n]) => {
  const dev = devices.find((d) => d.id === +devId);
  const maxAge = dev.status === 'active' ? 14 : dev.status === 'inactive' ? 12 : 6;
  const minAge = dev.status === 'inactive' ? 1.1 : dev.status === 'broken' ? 4 : 0;
  for (let i = 0; i < n; i++) {
    const isCough = rnd() > 0.14;                               // sebagian suara bukan batuk
    const tbRate = dev.id === 401 ? 0.34 : 0.12;               // poli paru → prevalensi lebih tinggi
    const tb = isCough && rnd() < tbRate;
    // jam ramai: pagi & sore
    const age = between(minAge, maxAge);
    const t = new Date(NOW.getTime() - age * DAY);
    const hr = pick([6, 7, 7, 8, 8, 9, 10, 11, 12, 13, 15, 16, 16, 17, 17, 18, 19, 20]);
    t.setHours(hr, Math.floor(rnd() * 60), Math.floor(rnd() * 60));
    if (t > NOW) t.setTime(NOW.getTime() - between(0.05, 0.9) * 3600000);
    const named = dev.id === 401 && rnd() < 0.55;              // di poli paru sebagian sudah diidentifikasi perawat
    const angle = Math.round(between(-80, 80));
    detections.push({
      uuid: uid(),
      deviceId: dev.id,
      time: t.getTime(),
      type: isCough ? 'Batuk' : '-',
      result: tb ? 'TB' : 'NEG',
      confidence: +(tb ? between(0.78, 0.995) : between(0.86, 0.999)).toFixed(4),
      name: named ? personName() : '',
      gender: named ? pick(['L', 'P']) : '',
      age: named ? Math.round(between(19, 68)) : '',
      doa: { azimuth: angle, confidence: +between(0.72, 0.97).toFixed(2), snr: +between(4, 21).toFixed(1),
             tdoa: [between(-0.3, 0.3), between(-0.3, 0.3), between(-0.3, 0.3)].map((v) => +v.toFixed(3)) },
      person: { tracked: isCough && rnd() > 0.08, id: 'P-' + Math.floor(between(100, 999)), score: +between(0.71, 0.96).toFixed(2), crowd: Math.floor(between(3, 9)) },
      reviewed: !tb || rnd() < 0.35,
      coughs: tb ? Math.floor(between(6, 12)) : Math.floor(between(1, 4))
    });
  }
});
detections.sort((a, b) => b.time - a.time);
// Contoh dari presentasi (UUID dipertahankan)
detections[0].uuid = 'mgw0l8vv'; detections[0].deviceId = 400; detections[0].result = 'NEG'; detections[0].type = '-'; detections[0].confidence = 0.9978; detections[0].coughs = 4;
const tbExample = detections.find((d) => d.deviceId === 400 && d.result === 'TB');
if (tbExample) { tbExample.uuid = 'mgqs60b3'; tbExample.confidence = 0.9933; tbExample.type = 'Batuk'; }

// ---------- Data batuk penelitian ----------
const symptomsPool = ['Batuk > 2 minggu', 'Batuk berdahak', 'Demam malam', 'Keringat malam', 'Berat badan turun', 'Sesak napas', 'Nyeri dada', 'Batuk darah', 'Nafsu makan turun'];
const takeSome = (pool, k) => { const p = pool.slice(); const out = []; for (let i = 0; i < k; i++) out.push(p.splice(Math.floor(rnd() * p.length), 1)[0]); return out; };

const webform = Array.from({ length: 34 }, (_, i) => {
  const tb = rnd() < 0.27;
  return {
    id: 'WF-' + String(1201 + i), time: NOW.getTime() - between(0, 30) * DAY, name: personName(), gender: pick(['L', 'P']), age: Math.round(between(17, 70)),
    city: pick(['Surabaya', 'Sidoarjo', 'Gresik', 'Malang', 'Mojokerto']), weeks: tb ? Math.round(between(2, 8)) : Math.round(between(0, 3)),
    symptoms: takeSome(symptomsPool, tb ? Math.floor(between(2, 5)) : Math.floor(between(0, 3))), recordings: Math.floor(between(1, 4)),
    result: tb ? 'TB' : 'NEG', confidence: +between(0.75, 0.99).toFixed(3)
  };
}).sort((a, b) => b.time - a.time);

const offline = Array.from({ length: 28 }, (_, i) => {
  const label = rnd() < 0.3 ? 'TB' : 'NEG';
  const pred = rnd() < 0.88 ? label : (label === 'TB' ? 'NEG' : 'TB');
  return {
    id: 'NO-' + String(301 + i).padStart(4, '0'), time: NOW.getTime() - between(2, 45) * DAY, gender: pick(['L', 'P']), age: Math.round(between(18, 72)),
    site: pick(['Puskesmas Tambaksari', 'Puskesmas Pucang Sewu', 'Posyandu Lansia Gubeng', 'RSKI UNAIR']), recordings: Math.floor(between(3, 10)),
    mic: pick(['Smartphone', 'ReSpeaker', 'Lavalier']), label, pred, collector: pick(['Luna', 'Henri', 'Naufal'])
  };
}).sort((a, b) => b.time - a.time);

const primer = Array.from({ length: 22 }, (_, i) => {
  const lab = rnd() < 0.72 ? 'Positif' : 'Negatif';
  const pred = rnd() < 0.9 ? (lab === 'Positif' ? 'TB' : 'NEG') : (lab === 'Positif' ? 'NEG' : 'TB');
  return {
    id: 'TBP-' + String(41 + i).padStart(3, '0'), time: NOW.getTime() - between(3, 60) * DAY, gender: pick(['L', 'P']), age: Math.round(between(18, 70)),
    lab, method: pick(['TCM (GeneXpert)', 'BTA Mikroskopis', 'TCM (GeneXpert)']), phase: lab === 'Positif' ? pick(['Intensif', 'Intensif', 'Lanjutan']) : '—',
    recordings: Math.floor(between(4, 14)), pred, confidence: +between(0.7, 0.99).toFixed(3), facility: 'RSKI Universitas Airlangga'
  };
}).sort((a, b) => b.time - a.time);

// ---------- Pelacakan pasien ----------
const STAGES = ['Terdeteksi', 'Skrining Lanjut', 'Terkonfirmasi', 'Pengobatan', 'Sembuh'];
const patients = Array.from({ length: 12 }, (_, i) => {
  const stage = [0, 1, 1, 2, 3, 3, 3, 3, 4, 2, 0, 3][i];
  const start = NOW.getTime() - (stage === 4 ? between(180, 220) : stage === 3 ? between(20, 150) : between(1, 20)) * DAY;
  const det = detections.filter((d) => d.result === 'TB')[i] || detections[i];
  const events = [];
  events.push({ stage: 0, t: start, text: 'Batuk terindikasi TB oleh ' + (devices.find((d) => d.id === det.deviceId) || devices[0]).name + ' (UUID ' + det.uuid + ')' });
  if (stage >= 1) events.push({ stage: 1, t: start + 2 * DAY, text: 'Dirujuk untuk pemeriksaan TCM / dahak di faskes' });
  if (stage >= 2) events.push({ stage: 2, t: start + 6 * DAY, text: 'Hasil TCM: MTB terdeteksi, Rif sensitif' });
  if (stage >= 3) events.push({ stage: 3, t: start + 9 * DAY, text: 'Mulai pengobatan OAT fase intensif (2 bulan)' });
  if (stage >= 3 && NOW.getTime() - start > 70 * DAY) events.push({ stage: 3, t: start + 70 * DAY, text: 'Masuk fase lanjutan (4 bulan), dahak konversi negatif' });
  if (stage >= 4) events.push({ stage: 4, t: start + 185 * DAY, text: 'Pengobatan lengkap, dinyatakan sembuh' });
  const daysIn = Math.floor((NOW.getTime() - start) / DAY);
  return {
    id: 'PSN-' + String(2510 + i), name: personName(), gender: pick(['L', 'P']), age: Math.round(between(20, 66)), nik: '3578' + '••••••••' + String(Math.floor(between(1000, 9999))),
    phone: '08' + Math.floor(between(1e9, 9.9e9)), facility: pick(['RSKI Universitas Airlangga', 'Puskesmas Gubeng', 'Puskesmas Tambaksari', 'RSUD Dr. Soetomo']),
    stage, start, daysIn, uuid: det.uuid, deviceId: det.deviceId,
    adherence: stage >= 3 ? Math.round(between(78, 100)) : null,
    nextVisit: stage < 4 ? NOW.getTime() + between(1, 14) * DAY : null,
    pic: pick(['dr. Rahma (Sp.P)', 'dr. Wibowo (Sp.P)', 'Ns. Maya', 'Ns. Fikri']),
    events
  };
});


export { NOW, STAGES };
export const seed = {
  devices: devices as Device[],
  detections: detections as Detection[],
  webform: webform as WebformRow[],
  offline: offline as OfflineRow[],
  primer: primer as PrimerRow[],
  patients: patients as Patient[],
};
