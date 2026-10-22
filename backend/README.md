# TB-Guard Backend (Go)

Proxy agen AI (Gemini/Vertex AI + Groq, rotasi key & fallback) dan transkripsi suara. Hanya stdlib Go, satu binary ~8MB, dijalankan di Cloud Run.

| Endpoint | Fungsi |
|---|---|
| `GET /healthz` | health check + status pool key Groq |
| `POST /api/auth/google` | tukar ID token Google (@gmail.com) dengan sesi |
| `POST /api/uploads` | unggah rekaman (dibatasi) ke Neon Object Storage |
| `GET /readyz` | siap bila PostgreSQL terkoneksi |
| `GET /api/bootstrap` | semua data (perangkat, deteksi, pasien, dataset), gzip |
| `POST/PATCH/DELETE /api/devices\|detections\|patients` | CRUD ke PostgreSQL |
| `POST /api/agent` | stream NDJSON (`content`/`reasoning`/`wait`/`done`/`error`) |
| `POST /api/agent/transcribe` | multipart `audio` -> `{text}` (Groq Whisper, fallback Gemini) |

## Struktur
```
backend/
  cmd/server/main.go      # wiring: config, DI, routing, graceful shutdown
  internal/
    config/               # env -> Config
    httpx/                # JSON, error API, CORS
    auth/                 # login Google (@gmail.com) + sesi HMAC + middleware
    db/                   # koneksi Neon (pgx pool), Handler (503/timeout/gzip), pemetaan error
    data/                 # skema + seed + CRUD perangkat/deteksi/pasien
    storage/              # Neon Object Storage (SigV4), unggahan dengan kuota, janitor
    ai/                   # agen Gemini/Groq, transkripsi, definisi tool
  deploy/setup-secrets.sh # Secret Manager (satu kali)
  scripts/gen-tools.mjs   # regenerasi internal/ai/tools.json dari frontend
```

## Keamanan
- Login hanya **Google Sign-In, akun @gmail.com** (tanpa username/password). Backend memverifikasi ID token Google dan menerbitkan sesi HMAC 7 hari.
- Semua endpoint data, agen, transkripsi, dan unggahan wajib `Authorization: Bearer <token>`. Hanya `/healthz`, `/readyz`, `/api/auth/google` yang terbuka.

## Database & storage (Neon)
- PostgreSQL di Neon lewat `DATABASE_URL` (pooler; query tanpa prepared statement cache). Skema dibuat otomatis saat start, data contoh dimuat sekali.
- Rekaman audio ke Neon Object Storage lewat `POST /api/uploads` (multipart `file`). Batas: 2 MB/file, 100 MB total, 30 unggahan/pengguna/hari, hanya audio, umur 30 hari (dihapus janitor). Semua bisa diatur lewat env `UPLOAD_*`.

## Jalankan lokal
```
cp .env.example .env     # isi nilainya
set -a; . ./.env; set +a
go run .
```
Frontend: `frontend/.env.local` berisi `NEXT_PUBLIC_BACKEND_URL=http://localhost:8080` dan `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

## Deploy (Google Cloud only)
1. `bash backend/deploy/setup-secrets.sh` (satu kali): secret dari `backend/.env` ke Secret Manager.
2. `gcloud builds submit --config cloudbuild.yaml --substitutions=_GOOGLE_CLIENT_ID=<client-id> .`
3. Tambahkan URL frontend ke Authorized JavaScript origins pada OAuth Client ID.

`internal/ai/tools.json` dibuat dari `frontend/lib/agent/tools.ts` (`node --experimental-strip-types scripts/gen-tools.mjs`).
