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

import { DEFAULT_MODEL_ID } from '@/lib/agent/models';
import { backendFetch } from '@/lib/backend';

type Args = Record<string, unknown>;
export type StepStatus = 'running' | 'done' | 'error' | 'awaiting' | 'rejected';
export interface Step { id: string; name: string; kind: string; label: string; args: Args; status: StepStatus; result?: unknown; error?: string; confirm?: string }
export type Part = { kind: 'text'; text: string } | { kind: 'reasoning'; text: string } | { kind: 'step'; step: Step };
export interface Usage { prompt: number; completion: number; total: number }
export interface Turn {
  id: string; role: 'user' | 'assistant'; text: string; parts: Part[]; error?: string; done?: boolean; notice?: string;
  usage?: Usage;      // total token seluruh langkah model pada jawaban ini
  ms?: number;        // lama sampai jawaban selesai (termasuk eksekusi tool)
  startedAt?: number; // untuk penghitung waktu saat menghasilkan
  model?: string;     // model yang benar-benar menjawab
}
export interface ChatSummary { id: string; title: string; pinned: boolean; model: string; tokens: number; turns: number; createdAt: number; updatedAt: number }

interface ToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
type ApiMessage = { role: 'user'; content: string } | { role: 'assistant'; content: string; tool_calls?: ToolCall[] } | { role: 'tool'; tool_call_id: string; content: string };

interface Agent {
  open: boolean; setOpen: (v: boolean) => void; toggle: () => void;
  turns: Turn[]; running: boolean;
  send: (text: string) => void; stop: () => void; reset: () => void; retry: () => void;
  /* riwayat chat tersimpan di database (per pengguna) */
  chatId: string; chats: ChatSummary[]; chatsLoading: boolean; totalTokens: number;
  refreshChats: () => void; openChat: (id: string) => Promise<void>;
  renameChat: (id: string, title: string) => Promise<void>; pinChat: (id: string, pinned: boolean) => Promise<void>;
  deleteChat: (id: string) => Promise<void>; clearChats: () => Promise<void>;
  decide: (stepId: string, ok: boolean) => void;
  confirmRisky: boolean; setConfirmRisky: (v: boolean) => void;
  model: string; setModel: (m: string) => void;
  /* agen dari halaman mana pun: buka panel lalu kirim pertanyaan; palet perintah Ctrl+K */
  ask: (text: string) => void; paletteOpen: boolean; setPaletteOpen: (v: boolean) => void;
}

const Ctx = React.createContext<Agent | null>(null);
const MAX_STEPS = 12;
const MODEL_RETRIES = 2;
const uid = () => Math.random().toString(36).slice(2, 10);
/** ringkasan singkat entitas yang sedang tampil di layar, agar kata "ini" pada perintah langsung bermakna */
function screenEntity(path: string, s: ReturnType<typeof useStore>): string {
  const dev = path.match(/^\/devices\/(\d+)/);
  if (dev) { const d = s.device(dev[1]); return d ? `Perangkat #${d.id} ${d.name} (${d.status}) di ${d.location}, ${d.zone}` : ''; }
  const det = path.match(/^\/detections\/([^/?#]+)/);
  if (det) { const d = s.detection(det[1]); return d ? `Deteksi ${d.uuid}: ${d.result} (${Math.round(d.confidence * 100)}%), perangkat #${d.deviceId}, ${d.reviewed ? 'sudah' : 'belum'} ditinjau` : ''; }
  const pat = path.match(/[?&]open=([^&]+)/);
  if (pat) { const p = s.patients.find((x) => x.id === decodeURIComponent(pat[1])); return p ? `Pasien ${p.id} ${p.name}, tahap ${p.stage}, ${p.facility}` : ''; }
  return '';
}
const newChatId = () => `c${uid()}${uid()}`;
const addUsage = (a: Usage | undefined, b: Usage | undefined): Usage | undefined => (b ? { prompt: (a?.prompt ?? 0) + b.prompt, completion: (a?.completion ?? 0) + b.completion, total: (a?.total ?? 0) + b.total } : a);
const MAX_SAVE_BYTES = 1_800_000;
/** chat yang dipulihkan: langkah yang belum selesai saat disimpan ditandai terputus */
const sanitizeTurns = (turns: Turn[]): Turn[] => turns.map((t) => ({
  ...t, done: true, notice: undefined,
  parts: t.parts.map((p) => (p.kind === 'step' && (p.step.status === 'running' || p.step.status === 'awaiting') ? { ...p, step: { ...p.step, status: 'error' as const, error: 'Terputus sebelum selesai.' } } : p)),
}));
const tick = () => new Promise((r) => setTimeout(r, 30)); // beri React waktu me-render perubahan store sebelum tool berikutnya

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const router = useRouter();

  const [open, setOpenState] = React.useState(false);
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [running, setRunning] = React.useState(false);
  const [confirmRisky, setConfirmRisky] = React.useState(true);
  // selalu mulai dari Gemini (service account Vertex AI); pilihan model lain hanya berlaku selama sesi
  const [model, setModel] = React.useState<string>(DEFAULT_MODEL_ID);
  // ID dibuat di browser (Math.random tidak boleh dievaluasi saat prerender)
  const [chatId, setChatId] = React.useState('');
  const [chats, setChats] = React.useState<ChatSummary[]>([]);
  const [chatsLoading, setChatsLoading] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const chatIdRef = React.useRef(chatId);
  const turnsRef = React.useRef<Turn[]>([]);
  React.useEffect(() => { chatIdRef.current = chatId; turnsRef.current = turns; });
  // eslint-disable-next-line react-hooks/set-state-in-effect -- ID chat hanya bisa dibuat di browser
  React.useEffect(() => { setChatId((c) => c || newChatId()); }, []);

  // nilai terbaru untuk dipakai di dalam loop async
  const live = React.useRef({ store, confirmRisky, model });
  React.useEffect(() => { live.current = { store, confirmRisky, model }; });
  const history = React.useRef<ApiMessage[]>([]);
  const abort = React.useRef<AbortController | null>(null);
  const pending = React.useRef(new Map<string, (ok: boolean) => void>());

  React.useEffect(() => {
    // chat agen selalu terbuka saat halaman pertama dimuat (desktop)
    setOpenState(window.innerWidth >= 1024);
  }, []);
  const setOpen = setOpenState;
  const toggle = React.useCallback(() => setOpenState((v) => !v), []);

  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'i') { e.preventDefault(); toggle(); }
      else if (key === 'k') { e.preventDefault(); setPaletteOpen((v) => !v); }
    };
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

  type ModelResult = { content: string; tool_calls: ToolCall[]; usage?: Usage; model?: string };
  const doneResult = (ev: { message?: { content?: string; tool_calls?: ToolCall[] }; usage?: Usage; model?: string }): ModelResult => ({
    content: ev.message?.content || '', tool_calls: Array.isArray(ev.message?.tool_calls) ? ev.message!.tool_calls! : [], usage: ev.usage, model: ev.model,
  });

  async function callModelOnce(turnId: string, signal: AbortSignal): Promise<ModelResult> {
    const { store: s, model: activeModel } = live.current;
    // halaman dibaca saat kirim; hook routing (usePathname dsb.) di root akan memblokir prerender rute dinamis
    const p = window.location.pathname + window.location.search;
    const res = await backendFetch('/api/agent', {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: history.current,
        model: activeModel,
        context: { path: p, user: s.user ? { name: s.user.name, role: s.user.role } : undefined, systemTime: fmt.longDate(NOW.getTime()), entity: screenEntity(p, s) },
      }),
    });
    if (!res.ok || !res.body) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `Server agen error (HTTP ${res.status})`); }
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '';
    const handle = (line: string) => {
      let ev;
      try { ev = JSON.parse(line); } catch { return; } // baris rusak diabaikan
      if (ev.type === 'reasoning') appendDelta(turnId, 'reasoning', ev.delta);
      else if (ev.type === 'content') appendDelta(turnId, 'text', ev.delta);
      else if (ev.type === 'wait') patch(turnId, (t) => ({ ...t, notice: ev.notice || `Menunggu kuota pulih, melanjutkan dalam ${ev.seconds} detik…` }));
      else if (ev.type === 'error') throw new Error(ev.error || 'Agen mengalami kesalahan.');
      else if (ev.type === 'done') { patch(turnId, (t) => (t.notice ? { ...t, notice: undefined } : t)); return ev; }
    };
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line) continue;
        const ev = handle(line);
        if (ev) return doneResult(ev);
      }
    }
    const msg = buf.trim() && handle(buf.trim());
    if (msg) return doneResult(msg);
    throw new Error('Koneksi ke agen terputus.');
  }

  /** panggil model dengan retry otomatis; isi setengah jadi dari percobaan gagal dibuang */
  async function callModel(turnId: string, signal: AbortSignal) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await callModelOnce(turnId, signal);
      } catch (e) {
        if (signal.aborted || attempt >= MODEL_RETRIES) throw e;
        // teks/reasoning setelah step terakhir milik percobaan yang gagal ini
        patch(turnId, (t) => ({ ...t, parts: t.parts.slice(0, t.parts.map((x) => x.kind).lastIndexOf('step') + 1), notice: `Koneksi tersendat, mencoba ulang (${attempt + 1}/${MODEL_RETRIES})…` }));
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        if (signal.aborted) throw e;
      }
    }
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
      const result = await prep.run();
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
    const t0 = Date.now();
    patch(turnId, (t) => ({ ...t, startedAt: t0 }));
    try {
      for (let i = 0; i < MAX_STEPS; i++) {
        const msg = await callModel(turnId, ctl.signal);
        patch(turnId, (t) => ({ ...t, usage: addUsage(t.usage, msg.usage), model: msg.model || t.model }));
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
      patch(turnId, (t) => ({ ...t, done: true, ms: Date.now() - t0, startedAt: undefined }));
      abort.current = null;
      setRunning(false);
      void persistSoon();
    }
  }

  const send = (text: string) => {
    const q = text.trim();
    if (!q || running) return;
    const turnId = uid();
    history.current.push({ role: 'user', content: q });
    setTurns((all) => [...all, { id: uid(), role: 'user', text: q, parts: [] }, { id: turnId, role: 'assistant', text: '', parts: [] }]);
    void loop(turnId);
    void persistSoon(); // pertanyaan langsung tersimpan; jawaban menyusul saat selesai
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
  const reset = () => { stop(); history.current = []; setTurns([]); setChatId(newChatId()); };

  /* ---- riwayat chat di database ---- */
  const totalTokens = turns.reduce((n, t) => n + (t.usage?.total ?? 0), 0);
  const refreshChats = React.useCallback(async () => {
    if (!live.current.store.user) return;
    setChatsLoading(true);
    try { const r = await backendFetch('/api/chats'); if (r.ok) setChats((await r.json()).chats ?? []); } catch { /* offline */ }
    finally { setChatsLoading(false); }
  }, []);
  React.useEffect(() => { if (store.user && open) void refreshChats(); }, [store.user, open, refreshChats]);

  /** simpan chat aktif; dipanggil setelah tiap jawaban selesai (menunggu React menerapkan state terakhir) */
  async function persistSoon() {
    await new Promise((r) => setTimeout(r, 60));
    const turnsNow = turnsRef.current, id = chatIdRef.current;
    if (!id || !live.current.store.user || !turnsNow.some((t) => t.role === 'user')) return;
    let saveTurns = turnsNow, saveHist = history.current;
    let body = JSON.stringify({ turns: saveTurns, history: saveHist });
    // terlalu besar: buang bagian paling lama (riwayat dipotong mulai dari pesan user)
    while (body.length > MAX_SAVE_BYTES && saveTurns.length > 2) {
      saveTurns = saveTurns.slice(Math.ceil(saveTurns.length / 2));
      let h = saveHist.slice(Math.ceil(saveHist.length / 2));
      const u = h.findIndex((m) => m.role === 'user'); h = u >= 0 ? h.slice(u) : h;
      saveHist = h;
      body = JSON.stringify({ turns: saveTurns, history: saveHist });
    }
    const first = turnsNow.find((t) => t.role === 'user')?.text ?? 'Percakapan';
    const tokens = turnsNow.reduce((n, t) => n + (t.usage?.total ?? 0), 0);
    try {
      const r = await backendFetch(`/api/chats/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: first.slice(0, 60), model: live.current.model, tokens, turns: saveTurns, history: saveHist }),
      });
      if (r.ok) void refreshChats();
    } catch { /* simpan berikutnya akan mencoba lagi */ }
  }

  const openChat = async (id: string) => {
    if (running) return;
    const r = await backendFetch(`/api/chats/${encodeURIComponent(id)}`);
    if (!r.ok) throw new Error('Chat tidak ditemukan');
    const c = await r.json();
    history.current = Array.isArray(c.history) ? c.history : [];
    setTurns(sanitizeTurns(Array.isArray(c.turns) ? c.turns : []));
    setChatId(c.id);
    if (c.model) setModel(c.model);
  };
  const call = async (method: string, path: string, body?: unknown) => {
    const r = await backendFetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error || `HTTP ${r.status}`);
  };
  const renameChat = async (id: string, title: string) => { await call('PATCH', `/api/chats/${encodeURIComponent(id)}`, { title }); await refreshChats(); };
  const pinChat = async (id: string, pinned: boolean) => { await call('PATCH', `/api/chats/${encodeURIComponent(id)}`, { pinned }); await refreshChats(); };
  const deleteChat = async (id: string) => {
    await call('DELETE', `/api/chats/${encodeURIComponent(id)}`);
    if (id === chatIdRef.current) reset();
    await refreshChats();
  };
  const clearChats = async () => { await call('DELETE', '/api/chats'); await refreshChats(); };
  const decide = (stepId: string, ok: boolean) => pending.current.get(stepId)?.(ok);

  /** tanya agen dari mana saja: buka panel dan kirim (bila agen sedang bekerja, hanya membuka panel) */
  const ask = (text: string) => { setOpenState(true); setTimeout(() => send(text), 0); };

  const value: Agent = { open, setOpen, toggle, ask, paletteOpen, setPaletteOpen, turns, running, send, stop, reset, retry, decide, confirmRisky, setConfirmRisky, model, setModel, chatId, chats, chatsLoading, totalTokens, refreshChats, openChat, renameChat, pinChat, deleteChat, clearChats };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAgent() {
  const a = React.useContext(Ctx);
  if (!a) throw new Error('useAgent di luar AgentProvider');
  return a;
}
