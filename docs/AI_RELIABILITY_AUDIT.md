# Audit keandalan AI — 23 Oktober 2026

## Bukti

- Log Cloud Run 22 Oktober 20:27 UTC menunjukkan Vertex HTTP 404 pada `gemini-2.5-flash` di `us-central1`. Ini bukti kegagalan konfigurasi sebelumnya, bukan bukti model 3.x gagal.
- Konfigurasi runtime yang diperiksa sudah memakai service account `hackathon-runtime` dan lokasi Gemini `global`. Konfigurasi Cloud Build kini menyatakan lokasi itu secara eksplisit dan menyamakan default dengan frontend/backend (`gemini-3.5-flash`).
- Smoke test langsung Cloud Run berhasil menjawab pertanyaan “Dasar hukum Perpres 67/2021?” menggunakan Gemini. Uji ini membuktikan alur layanan, bukan validasi isi jawaban hukum.

## Perbaikan

- HTTP 404 segera berpindah model; tidak mengulang endpoint yang sama tiga kali.
- Pemangkasan konteks menjaga satu giliran user lengkap, termasuk seluruh pasangan tool call/result.
- Snapshot riwayat diambil sebelum operasi async dan ditulis berurutan; respons lama tidak menimpa respons terbaru.
- Membuka/menghapus chat menunggu antrean simpan; chat aktif tidak diganti selama agen berjalan.
- Kegagalan/ pembatalan agen dicatat pada history Orchestra sebagai jawaban terhenti.
- Model audio Whisper dan klasifikasi Prompt Guard dikeluarkan dari pemilih model percakapan; pilihan tersimpan dimigrasikan.
- Klasifikasi mikrofon tidak lagi mengarang hasil negatif acak ketika backend tidak tersedia.

## Verifikasi

- `go test ./...`: lulus; tes database opt-in dilewati bila DATABASE_URL tidak diset.
- `npx tsc --noEmit` dan ESLint pada komponen agent yang diubah: lulus.
- Browser dengan API terkontrol: simpan berurutan, jawaban final lengkap, chat baru, buka history, dan pencatatan error Orchestra lulus.
- Cloud Run + PostgreSQL nyata: save/get/list/rename/pin dan perlindungan judul terhadap save berikutnya lulus. Record uji dihapus.
- `node frontend/scripts/check-ai-service.cjs`: menguji inference offline/HTTP 503 tidak menghasilkan klasifikasi palsu.

## Batas audit

- Ketersediaan provider/kuota tetap bergantung Google Cloud dan Groq.
- Modul klinis lama `frontend/lib/ai-service.ts` masih memakai endpoint ML terpisah (`NEXT_PUBLIC_API_URL`) dan fallback triase/status statis. Metrik pelatihan dan narasi klinis statis tersebut belum divalidasi oleh audit keandalan agent ini; jangan gunakan sebagai bukti performa model aktual.
- Pengujian history mencakup satu sesi browser. Konflik edit bersamaan lintas tab/perangkat belum memiliki versioning server.
