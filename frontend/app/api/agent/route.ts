/* Proxy agen ke Groq. API key hanya ada di server (.env → GROQ_API_KEY).
   Client mengirim riwayat pesan; server menambah system prompt + definisi tool, lalu men-stream
   balik event NDJSON: {type:'reasoning'|'content', delta} … {type:'done', message} atau {type:'error', error}. */
import Groq from 'groq-sdk';
import type { ChatCompletionMessageParam, ChatCompletionMessageToolCall } from 'groq-sdk/resources/chat/completions';
import { TOOL_SCHEMAS } from '@/lib/agent/tools';
import { systemPrompt, type AgentContext } from '@/lib/agent/prompt';

const MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
const MAX_MESSAGES = 60;

interface InMessage { role: string; content?: unknown; tool_calls?: ChatCompletionMessageToolCall[]; tool_call_id?: string }

/** hanya terima bentuk pesan yang wajar, dan potong riwayat lama di batas pesan user (pasangan tool_call/tool tetap utuh) */
function sanitize(raw: unknown): ChatCompletionMessageParam[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatCompletionMessageParam[] = [];
  for (const m of raw as InMessage[]) {
    const content = typeof m.content === 'string' ? m.content.slice(0, 20000) : '';
    if (m.role === 'user') out.push({ role: 'user', content });
    else if (m.role === 'assistant') out.push(m.tool_calls?.length ? { role: 'assistant', content, tool_calls: m.tool_calls } : { role: 'assistant', content });
    else if (m.role === 'tool' && m.tool_call_id) out.push({ role: 'tool', tool_call_id: m.tool_call_id, content });
  }
  if (out.length <= MAX_MESSAGES) return out;
  const from = out.findIndex((m, i) => i >= out.length - MAX_MESSAGES && m.role === 'user');
  return from < 0 ? out.slice(-1) : out.slice(from);
}

export async function POST(req: Request) {
  if (!process.env.GROQ_API_KEY) return Response.json({ error: 'GROQ_API_KEY belum diatur di frontend/.env' }, { status: 500 });
  let body: { messages?: unknown; context?: AgentContext };
  try { body = await req.json(); } catch { return Response.json({ error: 'Body bukan JSON' }, { status: 400 }); }
  const messages = sanitize(body.messages);
  if (!messages.length) return Response.json({ error: 'Pesan kosong' }, { status: 400 });

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(ctl) {
      const send = (e: object) => ctl.enqueue(enc.encode(JSON.stringify(e) + '\n'));
      // model kadang menghasilkan tool call rusak (tool_use_failed); ulangi sekali sebelum menyerah
      for (let attempt = 0; attempt < 2; attempt++) {
        let content = '';
        const calls: ChatCompletionMessageToolCall[] = [];
        try {
          const completion = await groq.chat.completions.create({
            model: MODEL,
            messages: [{ role: 'system', content: systemPrompt(body.context || {}) }, ...messages],
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
          const err = e as { status?: number; message?: string; error?: { error?: { code?: string; message?: string } } };
          const code = err.error?.error?.code;
          if (code === 'tool_use_failed' && attempt === 0 && !content) continue;
          send({ type: 'error', error: err.error?.error?.message || err.message || 'Gagal menghubungi Groq', status: err.status });
          break;
        }
      }
      ctl.close();
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } });
}
