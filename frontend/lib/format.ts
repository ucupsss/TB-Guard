import { NOW } from './data';

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const p2 = (n: number) => String(n).padStart(2, '0');

export const fmt = {
  dateTime: (t: number) => { const d = new Date(t); return `${d.getDate()} ${BULAN[d.getMonth()].slice(0, 3)} ${d.getFullYear()}, ${p2(d.getHours())}.${p2(d.getMinutes())}`; },
  date: (t: number) => { const d = new Date(t); return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`; },
  dateShort: (t: number) => { const d = new Date(t); return `${d.getDate()} ${BULAN[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; },
  dayShort: (t: number) => { const d = new Date(t); return `${d.getDate()} ${BULAN[d.getMonth()].slice(0, 3)}`; },
  time: (t: number) => { const d = new Date(t); return `${p2(d.getHours())}.${p2(d.getMinutes())}`; },
  longDate: (t: number) => { const d = new Date(t); return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()} ${p2(d.getHours())}.${p2(d.getMinutes())}.${p2(d.getSeconds())} WIB`; },
  ago: (t: number) => {
    const s = Math.max(0, (NOW.getTime() - t) / 1000);
    if (s < 60) return 'baru saja';
    if (s < 3600) return Math.floor(s / 60) + ' menit lalu';
    if (s < 86400) return Math.floor(s / 3600) + ' jam lalu';
    return Math.floor(s / 86400) + ' hari lalu';
  },
  pct: (v: number, d = 1) => (v * 100).toFixed(d).replace('.', ',') + '%',
  dec: (v: number, d = 2) => v.toFixed(d).replace('.', ','),
  num: (v: number) => v.toLocaleString('id-ID'),
  month: (m: number) => BULAN[m],
};

export const statusLabel = { active: 'Active', inactive: 'Inactive', broken: 'Broken' } as const;
export const azText = (az: number) => (az === 0 ? '0° (depan)' : `${az > 0 ? '+' : '−'}${Math.abs(az)}° (${az > 0 ? 'kanan' : 'kiri'})`);
export const initials = (name: string) => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
/** warna latar avatar per orang (identitas) */
export const personHue = (name: string) => { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

export function downloadCSV(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
