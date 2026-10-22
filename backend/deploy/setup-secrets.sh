#!/usr/bin/env bash
# Setup satu kali: aktifkan API, buat secret di Secret Manager dari backend/.env, beri akses ke service account runtime.
# Nilai rahasia tidak pernah dicetak. Jalankan dari root repo:
#   gcloud config set project hackathon-primestep-19
#   bash backend/deploy/setup-secrets.sh
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project)}"
ENV_FILE="${ENV_FILE:-backend/.env}"
RUNTIME_SA="${RUNTIME_SA:-hackathon-runtime@${PROJECT_ID}.iam.gserviceaccount.com}"
BUILD_SA="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')@cloudbuild.gserviceaccount.com"

set -a; . "$ENV_FILE"; set +a

gcloud services enable run.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com aiplatform.googleapis.com --project "$PROJECT_ID"

put() { # put <nama-secret> <nilai>
  [ -n "$2" ] || { echo "LEWATI $1 (kosong)"; return; }
  if gcloud secrets describe "$1" --project "$PROJECT_ID" >/dev/null 2>&1; then
    printf '%s' "$2" | gcloud secrets versions add "$1" --data-file=- --project "$PROJECT_ID" >/dev/null
  else
    printf '%s' "$2" | gcloud secrets create "$1" --data-file=- --replication-policy=automatic --project "$PROJECT_ID" >/dev/null
  fi
  gcloud secrets add-iam-policy-binding "$1" --member="serviceAccount:${RUNTIME_SA}" \
    --role=roles/secretmanager.secretAccessor --project "$PROJECT_ID" >/dev/null
  echo "OK  $1"
}

GROQ=""
[ -f backend/groq_keys.txt ] && GROQ="$(grep -v '^#' backend/groq_keys.txt | tr -s ' \r\n' ',' | sed 's/^,//; s/,$//')"
SESSION="$(gcloud secrets versions access latest --secret=session-secret --project "$PROJECT_ID" 2>/dev/null || openssl rand -base64 48 | tr -d '\n')"

put database-url "${DATABASE_URL:-}"
put s3-access-key-id "${S3_ACCESS_KEY_ID:-}"
put s3-secret-access-key "${S3_SECRET_ACCESS_KEY:-}"
put session-secret "$SESSION"
put groq-api-keys "${GROQ:-${GROQ_API_KEYS:-}}"

for role in roles/aiplatform.user; do  # best-effort: butuh izin IAM project
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${RUNTIME_SA}" --role="$role" --condition=None >/dev/null || echo "LEWATI binding $role (tidak ada izin; pastikan sudah ada)"
done
echo "Selesai. Deploy: gcloud builds submit --config cloudbuild.yaml --substitutions=_GOOGLE_CLIENT_ID=<client-id> ."
