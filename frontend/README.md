# TB Guard — frontend (Next.js)

Dashboard pemantauan batuk TB. Dibangun dengan **Next.js 16 (App Router) + Tailwind v4 + shadcn/ui di atas Radix UI**, tampilan mengikuti gaya template admin Rubick (sidebar biru, panel konten membulat, kartu putih).

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # mode produksi
```

Login dengan email & password apa saja (demo). Tambahkan `?preview=1` di URL mana pun untuk masuk otomatis dengan akun demo.

## Route

| URL | Halaman |
| --- | --- |
| `/login` | Masuk |
| `/` | Dashboard: ringkasan skrining, aktivitas perangkat, komposisi, peta, peringatan TB, deteksi terbaru, jadwal kontrol |
| `/devices` | Daftar perangkat |
| `/devices/new` | Wizard tambah perangkat |
| `/devices/[id]` | Detail perangkat + riwayat deteksi |
| `/detections/[uuid]` | Detail batuk: prediksi LSTM, waveform & mel-spectrogram, arah datang suara (DoA), pelacakan individu |
| `/data/webform` · `/data/offline` · `/data/primer` | Tiga sumber data batuk, filter & export CSV |
| `/patients` | Pelacakan pasien (kanban 5 tahap). `?from=<uuid>` membuka banner pendaftaran, `?open=<id>` membuka detail pasien |

## Struktur

```
app/            route (page.tsx tipis: Suspense + RequireAuth + view)
views/          isi tiap halaman (client component)
components/ui/  komponen shadcn/ui (Radix)
components/layout/  sidebar, top bar, AppLayout (dark mode)
components/tb/  komponen khusus TB: peta Leaflet, audio wavesurfer, gauge, dsb.
lib/data.ts     MOCK DATA deterministik — ganti dengan fetch ke backend
lib/store.tsx   state aplikasi (React context); titik sambung ke API nanti
```

## Masih demo

- Semua data adalah mock (`lib/data.ts`); perubahan (edit deteksi, tambah perangkat/pasien) hanya tersimpan di memori.
- Suara batuk disintesis di browser; frame kamera adalah ilustrasi SVG.
- Login tidak memeriksa kredensial; sesi disimpan di `sessionStorage`.
- Peta memakai tile CARTO, jadi butuh internet.
