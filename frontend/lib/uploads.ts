import { backendFetch } from './backend';

/* Rekaman batuk -> Neon Object Storage lewat backend. Batas (ukuran/kuota/harian/umur) dijaga di server. */
export interface UploadResult { id: string; size: number; contentType: string; usedBytes: number; maxBytes: number }

export async function uploadRecording(blob: Blob, detectionUuid?: string): Promise<UploadResult> {
  const fd = new FormData();
  fd.append('file', new File([blob], 'rekaman', { type: blob.type || 'audio/webm' }));
  if (detectionUuid) fd.append('detectionUuid', detectionUuid);
  const res = await backendFetch('/api/uploads', { method: 'POST', body: fd });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `Unggah gagal (HTTP ${res.status})`);
  return j as UploadResult;
}

/** URL unduh berumur 5 menit. */
export async function recordingUrl(id: string): Promise<string> {
  const res = await backendFetch(`/api/uploads/${encodeURIComponent(id)}/url`);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j.url as string;
}
