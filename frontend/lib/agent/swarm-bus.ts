'use client';

/* Event bus Swarm LIVE: menyambungkan chat agen (AgentProvider) ke kanvas /orchestra secara real-time.
   Chat memancarkan peristiwa; kanvas dan live trace mendengarkannya. Peristiwa sejak chat terakhir disimpan
   sebentar di memori supaya kanvas yang baru dibuka langsung menampilkan percakapan yang sedang/baru berjalan. */

export type SwarmLiveEvent =
  | { type: 'chat:start'; prompt: string }
  | { type: 'chat:routing'; intent: string; targetAgentId?: string }
  | { type: 'chat:tool_call'; toolName: string; agentId: string; args: Record<string, unknown> }
  | { type: 'chat:tool_done'; toolName: string; agentId: string; latencyMs: number; ok: boolean }
  | { type: 'chat:done'; totalMs: number; tokens?: number; activeAgents: string[] }
  | { type: 'chat:reset' };

export interface StampedEvent { event: SwarmLiveEvent; at: number }

const MAX_LOG = 300;
const KEY = 'tb_swarm_log';
const listeners = new Set<(e: StampedEvent) => void>();

/** jejak chat terakhir bertahan saat halaman di-refresh (sessionStorage), supaya /orchestra selalu menampilkan aktivitas terakhir */
function restore(): StampedEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const v: StampedEvent[] = JSON.parse(sessionStorage.getItem(KEY) || '[]');
    if (!Array.isArray(v) || !v.length) return [];
    const out = v.slice(-MAX_LOG);
    // halaman di-refresh saat chat berjalan: tutup jejaknya agar kanvas tidak tampak berjalan selamanya
    if (out[out.length - 1].event.type !== 'chat:done') out.push({ event: { type: 'chat:done', totalMs: 0, activeAgents: [] }, at: Date.now() });
    return out;
  } catch { return []; }
}
const persist = (l: StampedEvent[]) => { try { sessionStorage.setItem(KEY, JSON.stringify(l)); } catch { /* mode privat / penuh */ } };
let log: StampedEvent[] = restore();

export function emitSwarm(event: SwarmLiveEvent) {
  const stamped: StampedEvent = { event, at: Date.now() };
  if (event.type === 'chat:start' || event.type === 'chat:reset') log = [];
  if (event.type !== 'chat:reset') log = [...log.slice(-(MAX_LOG - 1)), stamped];
  persist(log);
  listeners.forEach((l) => l(stamped));
}

export function subscribeSwarm(fn: (e: StampedEvent) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** peristiwa sejak chat terakhir dimulai (untuk memutar ulang saat kanvas dibuka) */
export const swarmLog = (): StampedEvent[] => log;
