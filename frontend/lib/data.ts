/* Konstanta tampilan. Data simulasi (perangkat, deteksi, pasien, dataset) tidak lagi ada di frontend:
   disimpan di PostgreSQL (Neon) dan dimuat lewat backend (lihat lib/store.tsx). Generator ber-seed
   untuk data simulasi ada di backend/scripts/seed. */

// "Sekarang" dibuat tetap supaya grafik data simulasi selalu terisi
export const NOW = new Date('2025-10-20T16:00:00+07:00');

export const STAGES = ['Terdeteksi', 'Skrining Lanjut', 'Terkonfirmasi', 'Pengobatan', 'Sembuh'];
