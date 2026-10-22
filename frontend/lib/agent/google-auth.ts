import { GoogleAuth } from 'google-auth-library';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface GoogleGeminiAuth {
  mode: 'vertex' | 'generative-language';
  token?: string;
  apiKey?: string;
  projectId: string;
  location: string;
  clientEmail?: string;
}

// In-memory token caching untuk efisiensi serverless (Vercel / Cloud Run / Next.js)
let cachedToken: string | null = null;
let tokenExpiry = 0;
let cachedAuth: GoogleGeminiAuth | null = null;

const DEFAULT_PROJECT_ID = process.env.GCP_PROJECT_ID || 'hackathon-primestep-19';
const DEFAULT_LOCATION = process.env.GCP_LOCATION || 'us-central1';

/**
 * Normalisasi model Gemini untuk Vertex AI Google Cloud.
 * Model Gemini 2.5 Flash & 2.5 Pro telah aktif dan terverifikasi di project hackathon-primestep-19.
 */
export function normalizeVertexModel(modelId: string): string {
  if (modelId === 'gemini-1.5-flash' || modelId === 'gemini-2.0-flash') {
    return 'gemini-2.5-flash';
  }
  if (modelId === 'gemini-1.5-pro' || modelId === 'gemini-2.0-pro') {
    return 'gemini-2.5-pro';
  }
  return modelId;
}

/**
 * Mendapatkan kredensial autentikasi Google Gemini secara otomatis.
 * Mendukung 5 layer fallback yang aman dan kompatibel dengan Vercel & Google Cloud:
 * 1. Environment Variable `GCP_SERVICE_ACCOUNT_KEY` (Raw JSON atau Base64) - Sangat cocok untuk Vercel
 * 2. Environment Variable terpisah: `GCP_CLIENT_EMAIL` + `GCP_PRIVATE_KEY`
 * 3. File key service account (`GOOGLE_APPLICATION_CREDENTIALS` atau `gcp-key.json`)
 * 4. Local development ADC / `gcloud auth print-access-token` (otomatis di laptop lokal)
 * 5. `GEMINI_API_KEY` (Google AI Studio Generative Language API)
 */
export async function getGoogleGeminiAuth(): Promise<GoogleGeminiAuth> {
  const now = Date.now();

  // Gunakan cache token jika masih valid (> 60 detik sebelum expired)
  if (cachedAuth && cachedToken && tokenExpiry > now + 60000) {
    return { ...cachedAuth, token: cachedToken };
  }

  // ---------------------------------------------------------------------------
  // METHOD 1: GCP_SERVICE_ACCOUNT_KEY (JSON string atau Base64) - Optimal di Vercel
  // ---------------------------------------------------------------------------
  const rawKey = process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (rawKey && rawKey.trim()) {
    try {
      let jsonStr = rawKey.trim();
      // Handle base64 encoded JSON
      if (!jsonStr.startsWith('{')) {
        jsonStr = Buffer.from(jsonStr, 'base64').toString('utf-8');
      }
      const credentials = JSON.parse(jsonStr);
      const auth = new GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const client = await auth.getClient();
      const res = await client.getAccessToken();
      if (res.token) {
        cachedToken = res.token;
        tokenExpiry = now + 50 * 60 * 1000;
        cachedAuth = {
          mode: 'vertex',
          projectId: credentials.project_id || DEFAULT_PROJECT_ID,
          location: DEFAULT_LOCATION,
          clientEmail: credentials.client_email,
        };
        console.log(`[GoogleAuth] Berhasil autentikasi Vertex AI via GCP_SERVICE_ACCOUNT_KEY (${credentials.client_email || 'service account'}).`);
        return { ...cachedAuth, token: res.token };
      }
    } catch (err: unknown) {
      const e = err as Error;
      console.warn('[GoogleAuth] Peringatan: Gagal memproses GCP_SERVICE_ACCOUNT_KEY:', e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // METHOD 2: GCP_CLIENT_EMAIL + GCP_PRIVATE_KEY terpisah - Sangat mudah di Vercel
  // ---------------------------------------------------------------------------
  const clientEmail = process.env.GCP_CLIENT_EMAIL;
  const privateKeyRaw = process.env.GCP_PRIVATE_KEY;
  if (clientEmail && privateKeyRaw) {
    try {
      const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
      const auth = new GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey,
        },
        projectId: DEFAULT_PROJECT_ID,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const client = await auth.getClient();
      const res = await client.getAccessToken();
      if (res.token) {
        cachedToken = res.token;
        tokenExpiry = now + 50 * 60 * 1000;
        cachedAuth = {
          mode: 'vertex',
          projectId: DEFAULT_PROJECT_ID,
          location: DEFAULT_LOCATION,
          clientEmail,
        };
        console.log(`[GoogleAuth] Berhasil autentikasi Vertex AI via GCP_CLIENT_EMAIL (${clientEmail}).`);
        return { ...cachedAuth, token: res.token };
      }
    } catch (err: unknown) {
      const e = err as Error;
      console.warn('[GoogleAuth] Peringatan: Gagal memproses GCP_PRIVATE_KEY:', e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // METHOD 3: GOOGLE_APPLICATION_CREDENTIALS / gcp-key.json (File-based)
  // ---------------------------------------------------------------------------
  const possiblePaths = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(process.cwd(), 'gcp-key.json'),
    path.join(process.cwd(), 'frontend', 'gcp-key.json'),
    path.join(process.cwd(), 'gcp-sa-key.json'),
    path.join(process.cwd(), 'frontend', 'gcp-sa-key.json'),
  ].filter(Boolean) as string[];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        const auth = new GoogleAuth({
          keyFilename: p,
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });
        const client = await auth.getClient();
        const res = await client.getAccessToken();
        if (res.token) {
          cachedToken = res.token;
          tokenExpiry = now + 50 * 60 * 1000;
          cachedAuth = {
            mode: 'vertex',
            projectId: DEFAULT_PROJECT_ID,
            location: DEFAULT_LOCATION,
          };
          console.log(`[GoogleAuth] Berhasil autentikasi Vertex AI via file key: ${path.basename(p)}.`);
          return { ...cachedAuth, token: res.token };
        }
      }
    } catch {
      // lanjut cek opsi berikutnya
    }
  }

  // ---------------------------------------------------------------------------
  // METHOD 4: Google Cloud ADC atau gcloud CLI (Otomatis di Local Dev / Cloud Run)
  // ---------------------------------------------------------------------------
  try {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      projectId: DEFAULT_PROJECT_ID,
    });
    const client = await auth.getClient();
    const res = await client.getAccessToken();
    if (res.token) {
      cachedToken = res.token;
      tokenExpiry = now + 50 * 60 * 1000;
      cachedAuth = {
        mode: 'vertex',
        projectId: DEFAULT_PROJECT_ID,
        location: DEFAULT_LOCATION,
      };
      return { ...cachedAuth, token: res.token };
    }
  } catch {
    // Tidak ada ADC di lingkungan
  }

  // Fallback gcloud CLI (pada laptop lokal saat gcloud terlogin)
  try {
    const stdout = execSync('gcloud auth print-access-token', { timeout: 3500 }).toString().trim();
    if (stdout && stdout.startsWith('ya29.')) {
      cachedToken = stdout;
      tokenExpiry = now + 45 * 60 * 1000;
      cachedAuth = {
        mode: 'vertex',
        projectId: DEFAULT_PROJECT_ID,
        location: DEFAULT_LOCATION,
      };
      return { ...cachedAuth, token: stdout };
    }
  } catch {
    // gcloud CLI tidak terpasang atau tidak aktif
  }

  // ---------------------------------------------------------------------------
  // METHOD 5: GEMINI_API_KEY (Fallback ke Google AI Studio)
  // ---------------------------------------------------------------------------
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return {
      mode: 'generative-language',
      apiKey: process.env.GEMINI_API_KEY.trim(),
      projectId: DEFAULT_PROJECT_ID,
      location: DEFAULT_LOCATION,
    };
  }

  throw new Error(
    'Autentikasi Google Cloud / Gemini belum dikonfigurasi. Untuk Vercel, tambahkan `GCP_SERVICE_ACCOUNT_KEY` (atau `GCP_CLIENT_EMAIL` & `GCP_PRIVATE_KEY`) di menu Settings -> Environment Variables Vercel.'
  );
}
