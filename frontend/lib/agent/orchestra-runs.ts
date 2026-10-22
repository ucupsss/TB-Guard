'use client';

/* Rekaman jalannya Orchestra AI (chat live dan simulasi) di database lewat backend Go.
   Dipakai untuk memutar ulang alur kerja agen seperti transkrip percakapan. */
import { backendFetch } from '@/lib/backend';
import { ALL_TOOLS, type ExecutionStep } from '@/lib/agent/orchestrator';

export interface RunSummary { id: string; source: 'live' | 'simulation'; scenario: string; prompt: string; steps: number; totalMs: number; tokens: number; createdAt: number }
export interface Run extends Omit<RunSummary, 'steps'> { steps: ExecutionStep[] }

/** peristiwa jendela agar daftar riwayat menyegarkan diri setelah ada rekaman baru */
export const RUN_SAVED_EVENT = 'tb:orchestra-run-saved';

export async function saveRun(id: string, run: { source: 'live' | 'simulation'; scenario?: string; prompt: string; steps: ExecutionStep[]; totalMs: number; tokens: number }): Promise<boolean> {
  try {
    const res = await backendFetch(`/api/orchestra/runs/${encodeURIComponent(id)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...run, steps: run.steps.map((s) => ({ ...s, status: 'completed' })) }),
    });
    if (res.ok && typeof window !== 'undefined') window.dispatchEvent(new Event(RUN_SAVED_EVENT));
    if (!res.ok) console.warn('[orchestra] rekaman gagal disimpan: HTTP', res.status);
    return res.ok;
  } catch (e) { console.warn('[orchestra] rekaman gagal disimpan:', e); return false; }
}

export async function listRuns(): Promise<RunSummary[]> {
  const res = await backendFetch('/api/orchestra/runs');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).runs ?? [];
}

export async function getRun(id: string): Promise<Run> {
  const res = await backendFetch(`/api/orchestra/runs/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Rekaman tidak ditemukan');
  return res.json();
}

export async function deleteRun(id: string): Promise<void> {
  const res = await backendFetch(`/api/orchestra/runs/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

/* ---------------- penjelasan bahasa sehari-hari ---------------- */
export interface TranscriptMessage { role: 'user' | 'orchestrator' | 'agent'; who: string; text: string; result?: string; meta?: string }

const firstSentence = (s: string) => s.split(/(?<=[.!?])\s/)[0] ?? s;
const VERB = { read: 'mengambil data', write: 'menyimpan perubahan ke database', delete: 'menyimpan perubahan ke database', ui: 'menggerakkan tampilan layar' } as const;

/** Mengubah langkah-langkah teknis menjadi percakapan yang mudah dipahami orang awam. */
export function toTranscript(run: Run, agentName: (id: string) => string): TranscriptMessage[] {
  const out: TranscriptMessage[] = [{ role: 'user', who: 'Anda', text: run.prompt || '(tanpa teks)' }];
  for (const s of run.steps) {
    const ms = s.latencyMs ? `${s.latencyMs} ms` : undefined;
    if (s.agentId === 'orchestrator') {
      const last = s.title === 'Jawaban selesai';
      out.push({
        role: 'orchestrator', who: 'Koordinator',
        text: last ? `Pekerjaan selesai dan jawaban dikirim ke Anda. ${s.action}` : s.action,
        result: last ? `Total ${run.totalMs || s.latencyMs} ms${run.tokens ? `, ${run.tokens} token` : ''}` : s.outputData || undefined, meta: last ? undefined : ms,
      });
      continue;
    }
    const tool = s.toolCalled ? ALL_TOOLS.find((t) => t.name === s.toolCalled) : undefined;
    out.push({
      role: 'agent', who: agentName(s.agentId),
      text: tool ? `Saya ${VERB[tool.kind as keyof typeof VERB] ?? 'bekerja'} memakai alat "${tool.name}". ${firstSentence(tool.description)}` : s.action,
      result: s.outputData ? `Hasil: ${s.outputData}` : undefined, meta: ms,
    });
  }
  return out;
}
