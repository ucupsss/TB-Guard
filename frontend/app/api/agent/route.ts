/* Proxy agen ke Groq. API key hanya ada di server (.env → GROQ_API_KEY).
   Client mengirim riwayat pesan; server menambah system prompt + definisi tool, lalu men-stream
   balik event NDJSON: {type:'reasoning'|'content', delta} … {type:'wait', seconds} … {type:'done', message} atau {type:'error', error}.
   Kuota Groq gratis dihitung per menit (ITPM ~7rb token), jadi riwayat dipangkas ke anggaran token
   dan error 413/429 ditangani: pangkas lebih ketat atau tunggu kuota pulih lalu ulangi. */
import Groq from 'groq-sdk';
import type { ChatCompletionMessageParam, ChatCompletionMessageToolCall } from 'groq-sdk/resources/chat/completions';
import { TOOL_SCHEMAS } from '@/lib/agent/tools';
import { systemPrompt, type AgentContext } from '@/lib/agent/prompt';

const MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
/** anggaran token untuk riwayat pesan (di luar system prompt + tool), bisa dinaikkan bila tier Groq lebih besar */
const HISTORY_BUDGET = Number(process.env.GROQ_HISTORY_TOKENS) || 2500;
const MAX_WAIT_S = 45;

interface InMessage { role: string; content?: unknown; tool_calls?: ChatCompletionMessageToolCall[]; tool_call_id?: string }

/** perkiraan kasar token (teks Indonesia/JSON ≈ 3 karakter per token) */
const est = (m: ChatCompletionMessageParam) => Math.ceil((JSON.stringify(m).length) / 3) + 8;
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…[dipotong]' : s);

function parse(raw: unknown): ChatCompletionMessageParam[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatCompletionMessageParam[] = [];
  for (const m of raw as InMessage[]) {
    const content = typeof m.content === 'string' ? m.content.slice(0, 20000) : '';
    if (m.role === 'user') out.push({ role: 'user', content });
    else if (m.role === 'assistant') out.push(m.tool_calls?.length ? { role: 'assistant', content, tool_calls: m.tool_calls } : { role: 'assistant', content });
    else if (m.role === 'tool' && m.tool_call_id) out.push({ role: 'tool', tool_call_id: m.tool_call_id, content });
  }
  return out;
}

/** muatkan riwayat ke anggaran token: hasil tool lama diringkas, giliran lama dibuang di batas pesan user
    (pasangan tool_call/tool tetap utuh), hasil tool giliran ini dipotong bila masih terlalu besar */
function fit(msgs: ChatCompletionMessageParam[], budget: number): ChatCompletionMessageParam[] {
  const lastUser = msgs.map((m) => m.role).lastIndexOf('user');
  let out = msgs.map((m, i) => (m.role === 'tool' ? { ...m, content: cut(String(m.content), i < lastUser ? 300 : 4000) } : m));
  const total = () => out.reduce((n, m) => n + est(m), 0);
  while (total() > budget) {
    const next = out.findIndex((m, i) => i > 0 && m.role === 'user');
    if (next < 0) break;
    out = out.slice(next);
  }
  for (const n of [2000, 1000, 500]) {
    if (total() <= budget) break;
    out = out.map((m) => (m.role === 'tool' ? { ...m, content: cut(String(m.content), n) } : m));
  }
  return out;
}

type GroqErr = { status?: number; message?: string; headers?: unknown; error?: { error?: { code?: string; message?: string } } };

/** detik tunggu dari header retry-after atau teks "try again in 7.66s" */
function retryAfter(err: GroqErr) {
  const h = err.headers as { get?: (k: string) => string | null } & Record<string, string> | undefined;
  const v = Number(h?.get?.('retry-after') ?? h?.['retry-after']);
  if (v > 0) return Math.ceil(v);
  const m = /try again in (?:(\d+)m)?([\d.]+)s/i.exec(err.error?.error?.message || err.message || '');
  return m ? Math.ceil(Number(m[1] || 0) * 60 + Number(m[2])) : 0;
}

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((r) => { const t = setTimeout(r, ms); signal.addEventListener('abort', () => { clearTimeout(t); r(); }, { once: true }); });

export async function POST(req: Request) {
  if (!process.env.GROQ_API_KEY) return Response.json({ error: 'GROQ_API_KEY belum diatur di frontend/.env' }, { status: 500 });
  let body: { messages?: unknown; context?: AgentContext };
  try { body = await req.json(); } catch { return Response.json({ error: 'Body bukan JSON' }, { status: 400 }); }
  const all = parse(body.messages);
  if (!all.length) return Response.json({ error: 'Pesan kosong' }, { status: 400 });

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, maxRetries: 0 });
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(ctl) {
      const send = (e: object) => ctl.enqueue(enc.encode(JSON.stringify(e) + '\n'));
      let budget = HISTORY_BUDGET;
      let toolRetries = 2;
      let fix: ChatCompletionMessageParam[] = [];
      for (let attempt = 0; attempt < 5; attempt++) {
        let content = '';
        const calls: ChatCompletionMessageToolCall[] = [];
        try {
          const completion = await groq.chat.completions.create({
            model: MODEL,
            messages: [{ role: 'system', content: systemPrompt(body.context || {}) }, ...fit(all, budget), ...fix],
            tools: TOOL_SCHEMAS,
            tool_choice: 'auto',
            temperature: 0.6,
            top_p: 0.95,
            max_completion_tokens: 2048,
            reasoning_effort: 'default',
            reasoning_format: 'parsed',
            stream: true,
          }, { signal: req.signal });
          for await (const chunk of completion) {
            const d = chunk.choices[0]?.delta;
            if (!d) continue;
            if (d.reasoning) send({ type: 'reasoning', delta: d.reasoning });
            if (d.content) { content += d.content; send({ type: 'content', delta: d.content }); }
            for (const tc of d.tool_calls ?? []) {
              const c = (calls[tc.index] ??= { id: '', type: 'function', function: { name: '', arguments: '' } });
              if (tc.id) c.id = tc.id;
              if (tc.function?.name) c.function.name += tc.function.name;
              if (tc.function?.arguments) c.function.arguments += tc.function.arguments;
            }
          }
          send({ type: 'done', message: { role: 'assistant', content, tool_calls: calls.filter(Boolean) } });
          break;
        } catch (e) {
          if (req.signal.aborted) break;
          const err = e as GroqErr;
          const msg = err.error?.error?.message || err.message || 'Gagal menghubungi Groq';
          const canRetry = !content && attempt < 4;
          // model kadang memanggil tool yang tidak ada / argumen rusak (tool_use_failed): ulangi dengan catatan koreksi
          if (err.error?.error?.code === 'tool_use_failed' && toolRetries > 0 && canRetry) {
            toolRetries--;
            fix = [{ role: 'user', content: `(catatan sistem) Panggilan tool tadi ditolak: ${msg.slice(0, 200)}. Pakai hanya tool yang tersedia: ${TOOL_SCHEMAS.map((t) => t.function.name).join(', ')}.` }];
            continue;
          }
          if (canRetry && (err.status === 413 || /request too large/i.test(msg)) && budget > 600) {
            // satu request melebihi kuota per menit: pangkas riwayat lebih ketat lalu coba lagi
            budget = Math.floor(budget / 2);
            continue;
          }
          const wait = retryAfter(err);
          if (canRetry && err.status === 429 && wait && wait <= MAX_WAIT_S) {
            // kuota menit ini habis: tunggu sampai pulih
            send({ type: 'wait', seconds: wait });
            await sleep(wait * 1000 + 300, req.signal);
            if (req.signal.aborted) break;
            continue;
          }
          send({ type: 'error', error: msg, status: err.status });
          break;
        }
      }
      ctl.close();
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } });
}
