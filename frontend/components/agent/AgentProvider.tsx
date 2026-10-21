'use client';

/* State & loop agen. Ditaruh di level aplikasi supaya percakapan tetap ada saat pindah halaman.
   Loop: kirim riwayat ke /api/agent → stream teks/penalaran → jalankan tool call di browser
   (minta persetujuan untuk aksi berisiko) → kirim hasil tool → ulangi sampai model menjawab tanpa tool. */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useStore, NOW } from '@/lib/store';
import { fmt } from '@/lib/format';
import { prepareTool, describeTool, ToolError } from '@/lib/agent/execute';
import { toolKind } from '@/lib/agent/tools';

type Args = Record<string, unknown>;
export type StepStatus = 'running' | 'done' | 'error' | 'awaiting' | 'rejected';
export interface Step { id: string; name: string; kind: string; label: string; args: Args; status: StepStatus; result?: unknown; error?: string; confirm?: string }
export type Part = { kind: 'text'; text: string } | { kind: 'reasoning'; text: string } | { kind: 'step'; step: Step };
export interface Turn { id: string; role: 'user' | 'assistant'; text: string; parts: Part[]; error?: string; done?: boolean; notice?: string }

interface ToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
type ApiMessage = { role: 'user'; content: string } | { role: 'assistant'; content: string; tool_calls?: ToolCall[] } | { role: 'tool'; tool_call_id: string; content: string };

interface Agent {
  open: boolean; setOpen: (v: boolean) => void; toggle: () => void;
  turns: Turn[]; running: boolean;
  send: (text: string) => void; stop: () => void; reset: () => void; retry: () => void;
  decide: (stepId: string, ok: boolean) => void;
  confirmRisky: boolean; setConfirmRisky: (v: boolean) => void;
}

const Ctx = React.createContext<Agent | null>(null);
const MAX_STEPS = 12;
const OPEN_KEY = 'tbv_agent_open';
const uid = () => Math.random().toString(36).slice(2, 10);
const tick = () => new Promise((r) => setTimeout(r, 30)); // beri React waktu me-render perubahan store sebelum tool berikutnya

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const router = useRouter();

  const [open, setOpenState] = React.useState(false);
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [running, setRunning] = React.useState(false);
  const [confirmRisky, setConfirmRisky] = React.useState(true);

  // nilai terbaru untuk dipakai di dalam loop async
  const live = React.useRef({ store, confirmRisky });
  React.useEffect(() => { live.current = { store, confirmRisky }; });
  const history = React.useRef<ApiMessage[]>([]);
  const abort = React.useRef<AbortController | null>(null);
  const pending = React.useRef(new Map<string, (ok: boolean) => void>());

  React.useEffect(() => {
    try { setOpenState(localStorage.getItem(OPEN_KEY) !== '0' && window.innerWidth >= 1024); } catch { /* abaikan */ }
  }, []);
  const setOpen = React.useCallback((v: boolean) => { setOpenState(v); try { localStorage.setItem(OPEN_KEY, v ? '1' : '0'); } catch { /* abaikan */ } }, []);
  const toggle = React.useCallback(() => setOpenState((v) => { try { localStorage.setItem(OPEN_KEY, v ? '0' : '1'); } catch { /* abaikan */ } return !v; }), []);

  React.useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); toggle(); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [toggle]);

  const patch = (id: string, fn: (t: Turn) => Turn) => setTurns((all) => all.map((t) => (t.id === id ? fn(t) : t)));
  const patchStep = (turnId: string, stepId: string, p: Partial<Step>) =>
    patch(turnId, (t) => ({ ...t, parts: t.parts.map((x) => (x.kind === 'step' && x.step.id === stepId ? { ...x, step: { ...x.step, ...p } } : x)) }));
  /** tambahkan potongan stream ke part terakhir bila jenisnya sama, selain itu buat part baru */
  const appendDelta = (turnId: string, kind: 'text' | 'reasoning', delta: string) =>
    patch(turnId, (t) => {
      const last = t.parts[t.parts.length - 1];
      t = t.notice ? { ...t, notice: undefined } : t;
      if (last && last.kind === kind) return { ...t, parts: [...t.parts.slice(0, -1), { kind, text: last.text + delta }] };
      return { ...t, parts: [...t.parts, { kind, text: delta }] };
    });

  async function callModel(turnId: string, signal: AbortSignal): Promise<{ content: string; tool_calls: ToolCall[] }> {
    const { store: s } = live.current;
    // halaman dibaca saat kirim; hook routing (usePathname dsb.) di root akan memblokir prerender rute dinamis
    const p = window.location.pathname + window.location.search;
    const res = await fetch('/api/agent', {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.current, context: { path: p, user: s.user ? { name: s.user.name, role: s.user.role } : undefined, systemTime: fmt.longDate(NOW.getTime()) } }),
    });
    if (!res.ok || !res.body) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `Server agen error (HTTP ${res.status})`); }
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line) continue;
        const ev = JSON.parse(line);
        if (ev.type === 'reasoning') appendDelta(turnId, 'reasoning', ev.delta);
        else if (ev.type === 'content') appendDelta(turnId, 'text', ev.delta);
        else if (ev.type === 'wait') patch(turnId, (t) => ({ ...t, notice: `Menunggu kuota pulih, melanjutkan dalam ${ev.seconds} detik…` }));
        else if (ev.type === 'error') throw new Error(ev.error);
        else if (ev.type === 'done') { patch(turnId, (t) => (t.notice ? { ...t, notice: undefined } : t)); return ev.message; }
      }
    }
    throw new Error('Koneksi ke agen terputus.');
  }

  async function runTool(turnId: string, call: ToolCall, signal: AbortSignal): Promise<unknown> {
    const name = call.function.name;
    let args: Args = {};
    const step: Step = { id: call.id || uid(), name, kind: toolKind(name), label: name, args, status: 'running' };
    try { args = JSON.parse(call.function.arguments || '{}'); step.args = args; } catch { /* ditangani di bawah */ }
    step.label = describeTool(name, args);
    patch(turnId, (t) => ({ ...t, parts: [...t.parts, { kind: 'step', step }] }));
    try {
      if (call.function.arguments && !Object.keys(args).length && call.function.arguments.trim() !== '{}') throw new ToolError('Argumen tool bukan JSON valid.');
      const env = { store: () => live.current.store, navigate: (p: string) => router.push(p) };
      const prep = prepareTool(name, args, env, { confirmRisky: live.current.confirmRisky });
      if (prep.confirm) {
        patchStep(turnId, step.id, { status: 'awaiting', confirm: prep.confirm });
        const ok = await new Promise<boolean>((resolve) => {
          pending.current.set(step.id, resolve);
          signal.addEventListener('abort', () => resolve(false), { once: true });
        });
        pending.current.delete(step.id);
        if (!ok) { patchStep(turnId, step.id, { status: 'rejected' }); return { ok: false, error: 'Aksi ditolak pengguna. Jangan diulangi kecuali pengguna memintanya lagi.' }; }
        patchStep(turnId, step.id, { status: 'running' });
      }
      const result = prep.run();
      if (step.kind !== 'read') await tick();
      patchStep(turnId, step.id, { status: 'done', result });
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      patchStep(turnId, step.id, { status: 'error', error: msg });
      return { ok: false, error: msg };
    }
  }

  async function loop(turnId: string) {
    const ctl = new AbortController();
    abort.current = ctl;
    setRunning(true);
    try {
      for (let i = 0; i < MAX_STEPS; i++) {
        const msg = await callModel(turnId, ctl.signal);
        const calls = (msg.tool_calls || []).filter((c) => c.function?.name).map((c) => ({ ...c, id: c.id || uid() }));
        history.current.push(calls.length ? { role: 'assistant', content: msg.content || '', tool_calls: calls } : { role: 'assistant', content: msg.content || '' });
        if (!calls.length) return;
        // jalankan berurutan: aksi tulis bisa bergantung pada hasil sebelumnya; tiap tool_call wajib punya balasan tool
        for (const c of calls) {
          const result = ctl.signal.aborted ? { ok: false, error: 'Dibatalkan pengguna.' } : await runTool(turnId, c, ctl.signal);
          history.current.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(result).slice(0, 6000) });
        }
        if (ctl.signal.aborted) return;
      }
      appendDelta(turnId, 'text', '\n\n_Batas langkah tercapai. Kirim "lanjutkan" bila perlu._');
    } catch (e) {
      if (!ctl.signal.aborted) patch(turnId, (t) => ({ ...t, error: e instanceof Error ? e.message : String(e) }));
    } finally {
      patch(turnId, (t) => ({ ...t, done: true }));
      abort.current = null;
      setRunning(false);
    }
  }

  const send = (text: string) => {
    const q = text.trim();
    if (!q || running) return;
    const turnId = uid();
    history.current.push({ role: 'user', content: q });
    setTurns((all) => [...all, { id: uid(), role: 'user', text: q, parts: [] }, { id: turnId, role: 'assistant', text: '', parts: [] }]);
    void loop(turnId);
  };

  const retry = () => {
    if (running) return;
    // ulangi dari pesan user terakhir: buang balasan yang gagal
    const lastUser = history.current.map((m) => m.role).lastIndexOf('user');
    if (lastUser < 0) return;
    history.current = history.current.slice(0, lastUser + 1);
    const turnId = uid();
    setTurns((all) => [...all.slice(0, all.length - (all[all.length - 1]?.role === 'assistant' ? 1 : 0)), { id: turnId, role: 'assistant', text: '', parts: [] }]);
    void loop(turnId);
  };

  const stop = () => { abort.current?.abort(); pending.current.forEach((r) => r(false)); };
  const reset = () => { stop(); history.current = []; setTurns([]); };
  const decide = (stepId: string, ok: boolean) => pending.current.get(stepId)?.(ok);

  const value: Agent = { open, setOpen, toggle, turns, running, send, stop, reset, retry, decide, confirmRisky, setConfirmRisky };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAgent() {
  const a = React.useContext(Ctx);
  if (!a) throw new Error('useAgent di luar AgentProvider');
  return a;
}
