/* Saran perintah agen yang menyesuaikan halaman yang sedang dibuka (dipakai panel chat, palet perintah, dan chip halaman). */

export function pageLabel(path: string) {
  if (path === '/design') return '3D Prototype';
  if (path === '/') return '3D Public Area';
  if (path === '/dashboard') return 'Dashboard';
  if (path === '/market') return 'Peluang Pasar';
  if (path === '/users') return 'Pengguna';
  if (path === '/live-test') return 'Uji Suara Mikrofon';
  if (path === '/devices/new') return 'Add Device';
  if (/^\/devices\/\d+/.test(path)) return `Perangkat #${path.split('/')[2]}`;
  if (path.startsWith('/devices')) return 'Device List';
  if (path.startsWith('/detections/')) return `Deteksi ${path.split('/')[2]}`;
  if (path.startsWith('/data/')) return `Data ${path.split('/')[2]}`;
  if (path.startsWith('/patients')) return 'Pelacakan Pasien';
  return path;
}

export function suggestions(path: string): string[] {
  if (path.startsWith('/devices/new') || path === '/devices') return ['Tambah perangkat TB Guard 5', 'Perangkat mana yang rusak?', 'Tampilkan perangkat nonaktif'];
  if (/^\/devices\/\d+/.test(path)) return ['Ringkas perangkat ini', 'Tandai semua deteksi ditinjau', 'Jam paling ramai?'];
  if (path.startsWith('/detections/')) return ['Jelaskan deteksi ini', 'Tandai ditinjau · label TB', 'Daftarkan jadi pasien'];
  if (path.startsWith('/patients')) return ['Kepatuhan OAT < 90%?', 'Kontrol minggu ini?', 'Pasien tahap Pengobatan'];
  if (path.startsWith('/data/')) return ['Akurasi model?', 'Bandingkan per gender', '5 data terbaru'];
  if (path === '/') return ['Tunjukkan lokasi batuk terakhir', 'Arahkan kamera ke sensor', 'Ada batuk TB hari ini?'];
  if (path === '/market') return ['Ringkas potensi pasar untuk juri', 'Berapa penghematan jika turun 5%?', 'Buka Dashboard'];
  if (path === '/dashboard') return ['Ringkas kondisi hari ini', 'Berapa batuk TB belum ditinjau?', 'Buka deteksi TB terbaru'];
  return ['Berapa batuk TB belum ditinjau?', 'Jam paling ramai batuk?', 'Tunjukkan lokasi batuk terakhir'];
}

/** perintah umum yang selalu ada di palet perintah */
export const QUICK_PROMPTS: { label: string; prompt: string }[] = [
  { label: 'Ringkas kondisi sistem hari ini', prompt: 'Ringkas kondisi sistem hari ini: perangkat, deteksi TB, dan pasien.' },
  { label: 'Tunjukkan lokasi batuk di 3D', prompt: 'Tunjukkan lokasi batuk terakhir di 3D Public Area.' },
  { label: 'Tampilkan perangkat yang rusak', prompt: 'Tampilkan perangkat yang rusak di Device List.' },
  { label: 'Buka deteksi TB terbaru', prompt: 'Buka deteksi TB terbaru yang belum ditinjau.' },
  { label: 'Ganti ke tema gelap', prompt: 'Ganti ke tema gelap.' },
];
