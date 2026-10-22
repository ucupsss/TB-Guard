#!/usr/bin/env bash
# CI/CD satu kali: setiap push ke branch main -> Cloud Build -> deploy backend + frontend ke Cloud Run.
# Dijalankan oleh pemilik project (butuh izin IAM), dari root repo:
#   PROJECT_ID=hackathon-primestep-19 bash backend/deploy/setup-cicd.sh
#
# Prasyarat manual (OAuth GitHub, tidak bisa lewat CLI): hubungkan repo ke Cloud Build di
#   https://console.cloud.google.com/cloud-build/triggers;region=global  -> "Connect repository" -> GitHub
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project)}"
OWNER="${OWNER:-ucupsss}"
REPO="${REPO:-TB-Guard}"
BRANCH="${BRANCH:-main}"
NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
BUILD_SA="${NUMBER}-compute@developer.gserviceaccount.com"   # akun build bawaan project ini
RUNTIME_SA="hackathon-runtime@${PROJECT_ID}.iam.gserviceaccount.com"

# izin yang dibutuhkan langkah deploy di cloudbuild.yaml
for role in roles/run.admin roles/artifactregistry.writer roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${BUILD_SA}" --role="$role" --condition=None >/dev/null
done
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:${BUILD_SA}" --role=roles/iam.serviceAccountUser --project "$PROJECT_ID" >/dev/null

if gcloud builds triggers describe tbguard-main --region=global --project "$PROJECT_ID" >/dev/null 2>&1; then
  echo "trigger tbguard-main sudah ada"
else
  gcloud builds triggers create github --name=tbguard-main --region=global --project "$PROJECT_ID" \
    --repo-owner="$OWNER" --repo-name="$REPO" --branch-pattern="^${BRANCH}\$" \
    --build-config=cloudbuild.yaml --service-account="projects/${PROJECT_ID}/serviceAccounts/${BUILD_SA}"
fi
echo "Selesai: push ke ${BRANCH} akan otomatis build + deploy."
