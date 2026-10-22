/* Proxy agen AI bertenaga Google Gemini & Groq Cloud (Multi-Model & Key Auto-Rotation).
   Mendukung pergantian model dinamis: Gemini 2.5 Flash, Llama 3.3 70B, DeepSeek R1 Distill, Mixtral, Qwen, dll.
   Dilengkapi hot-reload & auto-rotation 85+ API key Groq serta optimasi kompresi token super hemat. */

import { TOOLS } from '@/lib/agent/tools';
import { systemPrompt, type AgentContext } from '@/lib/agent/prompt';
import { groqPool } from '@/lib/agent/groq-keys';
import { isGroqModel, DEFAULT_MODEL_ID } from '@/lib/agent/models';
import { getGoogleGeminiAuth, normalizeVertexModel } from '@/lib/agent/google-auth';

export const maxDuration = 60;

/** urutan model Groq cadangan bila model pilihan gagal */
const GROQ_FALLBACK_MODELS = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile'];

interface InToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface InMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content?: string;
  tool_calls?: InToolCall[];
  tool_call_id?: string;
}

/** Kompresi output tool agar tidak membuang kuota token (hemat maksimal) */
function pruneToolOutput(raw: unknown): unknown {
  if (Array.isArray(raw)) {
    if (raw.length > 6) {
      return {
        total: raw.length,
        items: raw.slice(0, 6).map(pruneToolOutput),
        _note: `Dipotong 6 dari ${raw.length} item untuk efisiensi kuota.`,
      };
    }
    return raw.map(pruneToolOutput);
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v) && v.length > 6) {
        out[k] = {
          total: v.length,
          items: v.slice(0, 6).map(pruneToolOutput),
          _note: `Dipotong 6 dari ${v.length} item.`,
        };
      } else {
        out[k] = pruneToolOutput(v);
      }
    }
    return out;
  }
  if (typeof raw === 'string' && raw.length > 1200) {
    return raw.slice(0, 1200) + '... [ringkasan dipotong]';
  }
  return raw;
}

/** Potong riwayat percakapan lama untuk menghemat kuota token input */
function pruneMessages(msgs: InMessage[], maxTurns = 8): InMessage[] {
  if (msgs.length <= maxTurns) return msgs;

  // Pertahankan pesan-pesan terakhir
  const sliced = msgs.slice(-maxTurns);

  // Jika pesan pertama dari potongan adalah 'tool', cari pesan 'assistant' pasangannya agar API tidak error
  if (sliced[0]?.role === 'tool') {
    const firstToolId = sliced[0].tool_call_id;
    const parentIdx = msgs.findIndex((m) => m.tool_calls?.some((tc) => tc.id === firstToolId));
    if (parentIdx >= 0 && parentIdx < msgs.length - maxTurns) {
      return [msgs[parentIdx], ...sliced];
    }
  }

  return sliced;
}

/** Skema parameter standar OpenAI / Groq (lowercase types) */
function cleanOpenAISchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (k === 'type') {
      if (Array.isArray(v)) {
        const types = v.map((t) => String(t).toLowerCase());
        out.type = types.find((t) => t !== 'null') || 'string';
      } else {
        out.type = String(v).toLowerCase();
      }
    } else if (k === 'properties' && v && typeof v === 'object') {
      const props: Record<string, unknown> = {};
      for (const [pName, pVal] of Object.entries(v as Record<string, unknown>)) {
        props[pName] = cleanOpenAISchema(pVal);
      }
      out.properties = props;
    } else if (k === 'items') {
      out.items = cleanOpenAISchema(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Skema parameter Google Gemini (uppercase types) */
function cleanGeminiSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (k === 'type') {
      if (Array.isArray(v)) {
        const types = v.map((t) => String(t).toUpperCase());
        const nonNull = types.find((t) => t !== 'NULL') || 'STRING';
        out.type = nonNull;
        out.nullable = types.includes('NULL');
      } else {
        out.type = String(v).toUpperCase();
      }
    } else if (k === 'properties' && v && typeof v === 'object') {
      const props: Record<string, unknown> = {};
      for (const [pName, pVal] of Object.entries(v as Record<string, unknown>)) {
        props[pName] = cleanGeminiSchema(pVal);
      }
      out.properties = props;
    } else if (k === 'items') {
      out.items = cleanGeminiSchema(v);
    } else if (k === 'enum' && Array.isArray(v)) {
      const filtered = v.filter((x) => x !== null && x !== undefined && String(x).trim() !== '').map(String);
      if (filtered.length > 0) out.enum = filtered;
    } else {
      out[k] = v;
    }
  }
  return out;
}

const geminiFunctions = TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  parameters: cleanGeminiSchema(t.parameters),
}));

const groqTools = TOOLS.map((t) => ({
  type: 'function' as const,
  function: {
    name: t.name,
    description: t.description,
    parameters: cleanOpenAISchema(t.parameters),
  },
}));

export async function POST(req: Request) {
  let body: { messages?: InMessage[]; context?: AgentContext; model?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Body bukan JSON' }, { status: 400 });
  }

  const rawMsgs = Array.isArray(body.messages) ? body.messages : [];
  if (!rawMsgs.length) {
    return Response.json({ error: 'Pesan kosong' }, { status: 400 });
  }

  // Pilih model (prioritas: request body -> env GEMINI_MODEL -> default)
  const selectedModel = body.model || process.env.GEMINI_MODEL || DEFAULT_MODEL_ID;
  const useGroq = isGroqModel(selectedModel);

  // Kompresi riwayat percakapan untuk efisiensi token
  const prunedMsgs = pruneMessages(rawMsgs, 8);

  const enc = new TextEncoder();
  type Send = (e: object) => void;
  // batas kerja total di bawah maxDuration supaya stream selalu sempat ditutup dengan done/error
  const deadline = Date.now() + 50_000;

  /** fetch yang ikut batal saat klien pergi dan punya batas waktu sendiri */
  const fetchWithTimeout = async (url: string, init: RequestInit, ms: number) => {
    const ctl = new AbortController();
    const onAbort = () => ctl.abort();
    req.signal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => ctl.abort(), Math.max(1000, Math.min(ms, deadline - Date.now())));
    try {
      return await fetch(url, { ...init, signal: ctl.signal });
    } finally {
      clearTimeout(timer);
      req.signal.removeEventListener('abort', onAbort);
    }
  };

  /** Stream NDJSON yang dijamin berakhir: run() mengembalikan pesan error atau null bila sukses */
  const ndjson = (run: (send: Send) => Promise<void>) =>
    new Response(
      new ReadableStream({
        async start(ctl) {
          const send: Send = (e) => {
            try {
              ctl.enqueue(enc.encode(JSON.stringify(e) + '\n'));
            } catch {
              // stream sudah ditutup
            }
          };
          try {
            await run(send);
          } catch (err: unknown) {
            if (!req.signal.aborted) send({ type: 'error', error: (err as Error)?.message || 'Terjadi kesalahan pada agen.' });
          } finally {
            try {
              ctl.close();
            } catch {
              // sudah ditutup
            }
          }
        },
      }),
      { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } }
    );

  // =========================================================================
  // GROQ CLOUD (Qwen, GPT-OSS, Llama, dll.)
  // Rotasi key otomatis + pindah ke model cadangan bila model utama gagal
  // =========================================================================
  const runGroq = async (send: Send, targetModel: string): Promise<string | null> => {
    const sysText = systemPrompt(body.context || {});
    const openAiMsgs: Array<{
      role: 'system' | 'user' | 'assistant' | 'tool';
      content?: string | null;
      tool_calls?: InToolCall[];
      tool_call_id?: string;
    }> = [{ role: 'system', content: sysText }];

    for (const m of prunedMsgs) {
      if (m.role === 'user') {
        openAiMsgs.push({ role: 'user', content: m.content || '' });
      } else if (m.role === 'assistant') {
        openAiMsgs.push({
          role: 'assistant',
          // assistant tanpa tool_calls wajib punya content string
          content: m.content || (m.tool_calls?.length ? null : ''),
          ...(m.tool_calls?.length ? { tool_calls: m.tool_calls } : {}),
        });
      } else if (m.role === 'tool' && m.tool_call_id) {
        let parsed = m.content;
        try {
          parsed = JSON.stringify(pruneToolOutput(typeof m.content === 'string' ? JSON.parse(m.content) : m.content));
        } catch {
          parsed = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        }
        openAiMsgs.push({
          role: 'tool',
          tool_call_id: m.tool_call_id,
          content: parsed as string,
        });
      }
    }

    const models = [targetModel, ...GROQ_FALLBACK_MODELS.filter((m) => m !== targetModel)];
    let modelIdx = 0;
    let modelFails = 0;
    let limited = 0;
    let lastErr = 'Groq tidak merespons.';
    const nextModel = () => {
      modelIdx++;
      modelFails = 0;
      limited = 0;
      if (modelIdx < models.length) send({ type: 'wait', seconds: 1, notice: `Beralih ke model cadangan ${models[modelIdx]}…` });
      return modelIdx < models.length;
    };

    for (let attempt = 0; attempt < 24 && Date.now() < deadline - 3000 && !req.signal.aborted; attempt++) {
      const currentKey = groqPool.getActiveKey();
      if (!currentKey) return 'Tidak ada API key Groq yang aktif.';
      const model = models[modelIdx];

      let groqRes: Response;
      try {
        groqRes = await fetchWithTimeout(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${currentKey.key}`,
            },
            body: JSON.stringify({
              model,
              messages: openAiMsgs,
              tools: groqTools,
              tool_choice: 'auto',
              temperature: 0.3,
              max_tokens: 1536,
              stream: true,
            }),
          },
          25_000
        );
      } catch (err: unknown) {
        if (req.signal.aborted) return null;
        // jaringan putus / timeout: istirahatkan key ini sebentar lalu coba key lain
        groqPool.markRateLimited(currentKey.key, 15);
        lastErr = `Koneksi ke Groq gagal: ${(err as Error)?.message || 'timeout'}`;
        continue;
      }

      if (groqRes.status === 429 || groqRes.status === 413) {
        const retryAfter = Number(groqRes.headers.get('retry-after')) || 20;
        groqPool.markRateLimited(currentKey.key, Math.min(Math.max(retryAfter, 2), 60));
        lastErr = 'Kuota Groq sedang penuh, coba lagi sebentar.';
        // kuota Groq dihitung per model: setelah beberapa key penuh, pindah model lebih efektif daripada menunggu
        if (++limited >= 4) {
          if (!nextModel()) {
            // semua model penuh: tunggu sebentar lalu ulangi dari model pertama
            modelIdx = 0;
            limited = 0;
            send({ type: 'wait', seconds: 3, notice: 'Semua kuota Groq penuh, menunggu 3 detik…' });
            await new Promise((r) => setTimeout(r, 3000));
          }
        } else {
          send({
            type: 'wait',
            seconds: 1,
            notice: `Rotasi API Key Groq [${currentKey.index}/${currentKey.total}] karena limit kuota…`,
          });
        }
        continue;
      }

      if (!groqRes.ok) {
        const errText = await groqRes.text().catch(() => '');
        let parsedErr = errText;
        let code = '';
        try {
          const j = JSON.parse(errText).error;
          parsedErr = j?.message || errText;
          code = j?.code || '';
        } catch {
          // abaikan
        }
        const lowerErr = `${code} ${parsedErr}`.toLowerCase();
        lastErr = `Groq API Error (${groqRes.status}): ${parsedErr}`;

        // key dibatasi / tidak valid: nonaktifkan permanen dan rotasi ke key berikutnya
        if (lowerErr.includes('restricted') || lowerErr.includes('deactivated') || groqRes.status === 401 || groqRes.status === 403 || lowerErr.includes('invalid_api_key')) {
          groqPool.markInvalid(currentKey.key);
          // key mati tidak dihitung sebagai percobaan; pool menyusut sampai habis sendiri
          attempt--;
          continue;
        }
        // gangguan sementara di server Groq
        if (groqRes.status >= 500 || lowerErr.includes('rate_limit')) {
          groqPool.markRateLimited(currentKey.key, 30);
          continue;
        }
        // model tidak ada / dipensiunkan: langsung pakai model cadangan
        if (groqRes.status === 404 || lowerErr.includes('model_not_found') || lowerErr.includes('decommissioned') || lowerErr.includes('does not exist')) {
          if (!nextModel()) return lastErr;
          continue;
        }
        // tool call rusak (tool_use_failed) atau 400 lain: ulangi sekali, lalu pindah model
        if (++modelFails >= 2 && !nextModel()) return lastErr;
        continue;
      }

      const reader = groqRes.body?.getReader();
      if (!reader) {
        lastErr = 'Response stream Groq tidak tersedia';
        continue;
      }

      const dec = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let sentAny = false;
      const toolCallsByIndex: Record<number, { id: string; name: string; args: string }> = {};

      const handleLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) return;
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr || jsonStr === '[DONE]') return;
        try {
          const data = JSON.parse(jsonStr);
          const delta = data.choices?.[0]?.delta;
          if (!delta) return;

          // Reasoning support (DeepSeek R1 reasoning_content)
          if (delta.reasoning_content || delta.reasoning) {
            sentAny = true;
            send({ type: 'reasoning', delta: delta.reasoning_content || delta.reasoning });
          }

          if (typeof delta.content === 'string' && delta.content) {
            sentAny = true;
            fullContent += delta.content;
            send({ type: 'content', delta: delta.content });
          }

          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCallsByIndex[idx]) {
                toolCallsByIndex[idx] = {
                  id: tc.id || `call_${idx}_${Math.random().toString(36).slice(2, 8)}`,
                  name: '',
                  args: '',
                };
              }
              if (tc.id) toolCallsByIndex[idx].id = tc.id;
              if (tc.function?.name) toolCallsByIndex[idx].name += tc.function.name;
              if (tc.function?.arguments) toolCallsByIndex[idx].args += tc.function.arguments;
            }
          }
        } catch {
          // abaikan chunk yang belum selesai
        }
      };

      let streamErr: unknown = null;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += dec.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          lines.forEach(handleLine);
        }
        if (buffer) handleLine(buffer);
      } catch (err: unknown) {
        if (req.signal.aborted) return null;
        streamErr = err;
      }

      const collectedCalls: InToolCall[] = Object.values(toolCallsByIndex)
        .filter((tc) => tc.name)
        .map((tc) => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.args || '{}' } }));

      // stream putus sebelum ada isi: ulangi diam-diam dengan key lain
      if (streamErr && !sentAny && !collectedCalls.length) {
        groqPool.markRateLimited(currentKey.key, 15);
        lastErr = `Stream Groq terputus: ${(streamErr as Error)?.message || 'unknown'}`;
        continue;
      }
      // jawaban kosong total: anggap gagal dan coba lagi
      if (!sentAny && !collectedCalls.length) {
        lastErr = 'Model tidak mengembalikan jawaban.';
        if (++modelFails >= 2 && !nextModel()) return lastErr;
        continue;
      }

      send({ type: 'done', message: { role: 'assistant', content: fullContent, tool_calls: collectedCalls } });
      return null;
    }

    return req.signal.aborted ? null : lastErr;
  };

  const groqReady = () => !!groqPool.getActiveKey();

  // =========================================================================
  // GOOGLE GEMINI (Vertex AI Google Cloud & Generative Language API)
  // Bila kredensial belum ada atau Gemini gagal, otomatis dialihkan ke Groq
  // =========================================================================
  let googleAuth: Awaited<ReturnType<typeof getGoogleGeminiAuth>> | null = null;
  let authErr = '';
  try {
    googleAuth = await getGoogleGeminiAuth();
  } catch (err: unknown) {
    authErr = (err as Error)?.message || 'Kredensial Google Cloud Vertex AI atau GEMINI_API_KEY belum tersedia.';
  }

  const toolNameMap = new Map<string, string>();
  for (const m of prunedMsgs) {
    if (m.tool_calls) {
      for (const tc of m.tool_calls) {
        if (tc.id && tc.function?.name) {
          toolNameMap.set(tc.id, tc.function.name);
        }
      }
    }
  }

  type GeminiPart =
    | { text: string; thought?: boolean }
    | { functionCall: { name: string; args: Record<string, unknown> } }
    | { functionResponse: { name: string; response: Record<string, unknown> } };

  interface GeminiContent {
    role: 'user' | 'model';
    parts: GeminiPart[];
  }

  const contents: GeminiContent[] = [];

  for (const m of prunedMsgs) {
    if (m.role === 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: typeof m.content === 'string' && m.content ? m.content : ' ' }],
      });
    } else if (m.role === 'assistant') {
      const parts: GeminiPart[] = [];
      if (typeof m.content === 'string' && m.content) {
        parts.push({ text: m.content });
      }
      if (m.tool_calls?.length) {
        for (const tc of m.tool_calls) {
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments || '{}');
          } catch {
            parsedArgs = {};
          }
          parts.push({
            functionCall: {
              name: tc.function.name,
              args: parsedArgs,
            },
          });
        }
      }
      if (parts.length > 0) {
        contents.push({ role: 'model', parts });
      }
    } else if (m.role === 'tool' && m.tool_call_id) {
      const fnName = toolNameMap.get(m.tool_call_id) || 'tool';
      let parsedResponse: Record<string, unknown> = {};
      try {
        const raw = typeof m.content === 'string' ? JSON.parse(m.content) : m.content;
        parsedResponse = pruneToolOutput(raw) as Record<string, unknown>;
      } catch {
        parsedResponse = { output: m.content };
      }

      const responsePart: GeminiPart = {
        functionResponse: {
          name: fnName,
          response: { result: parsedResponse },
        },
      };

      const last = contents[contents.length - 1];
      if (last && last.role === 'user') {
        last.parts.push(responsePart);
      } else {
        contents.push({
          role: 'user',
          parts: [responsePart],
        });
      }
    }
  }

  // Gemini menolak percakapan yang tidak diawali pesan user
  while (contents.length && contents[0].role !== 'user') contents.shift();

  const runGemini = async (send: Send, auth: NonNullable<typeof googleAuth>, geminiModel: string): Promise<string | null> => {
    if (!contents.length) return 'Pesan kosong setelah dipangkas.';
    const sysText = systemPrompt(body.context || {});
    const payload = {
      systemInstruction: {
        parts: [{ text: sysText }],
      },
      contents,
      tools: [
        {
          functionDeclarations: geminiFunctions,
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1536,
      },
    };

    let geminiUrl: string;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (auth.mode === 'vertex') {
      const vertexModel = normalizeVertexModel(geminiModel);
      geminiUrl = `https://${auth.location}-aiplatform.googleapis.com/v1/projects/${auth.projectId}/locations/${auth.location}/publishers/google/models/${vertexModel}:streamGenerateContent?alt=sse`;
      headers['Authorization'] = `Bearer ${auth.token}`;
    } else {
      geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?key=${auth.apiKey}&alt=sse`;
    }

    let response: Response | null = null;
    let lastErr = '';
    // satu kali ulang untuk gangguan sementara Vertex (429 RESOURCE_EXHAUSTED / 5xx / jaringan)
    for (let attempt = 0; attempt < 2 && !response; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 1500));
      if (req.signal.aborted) return null;
      try {
        const res = await fetchWithTimeout(geminiUrl, { method: 'POST', headers, body: JSON.stringify(payload) }, 25_000);
        if (res.ok) {
          response = res;
          break;
        }
        const errText = await res.text().catch(() => '');
        let parsedErr = errText;
        try {
          parsedErr = JSON.parse(errText).error?.message || errText;
        } catch {
          // abaikan
        }
        lastErr = `Gemini API Error (${res.status}): ${parsedErr}`;
        if (res.status !== 429 && res.status < 500) return lastErr;
      } catch (err: unknown) {
        if (req.signal.aborted) return null;
        lastErr = `Koneksi ke Gemini gagal: ${(err as Error)?.message || 'timeout'}`;
      }
    }
    if (!response) return lastErr;

    const reader = response.body?.getReader();
    if (!reader) return 'Response stream Gemini tidak tersedia';

    const dec = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let sentAny = false;
    const collectedCalls: InToolCall[] = [];

    const handleLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) return;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr) return;
      try {
        const data = JSON.parse(jsonStr);
        const parts = data.candidates?.[0]?.content?.parts;
        if (!Array.isArray(parts)) return;
        for (const part of parts) {
          if (typeof part.text === 'string' && part.text) {
            sentAny = true;
            if (part.thought) {
              send({ type: 'reasoning', delta: part.text });
            } else {
              fullContent += part.text;
              send({ type: 'content', delta: part.text });
            }
          }
          if (part.functionCall) {
            collectedCalls.push({
              id: 'call_' + Math.random().toString(36).slice(2, 10),
              type: 'function',
              function: {
                name: part.functionCall.name,
                arguments: JSON.stringify(part.functionCall.args || {}),
              },
            });
          }
        }
      } catch {
        // abaikan
      }
    };

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach(handleLine);
      }
      if (buffer) handleLine(buffer);
    } catch (err: unknown) {
      if (req.signal.aborted) return null;
      if (!sentAny && !collectedCalls.length) return `Stream Gemini terputus: ${(err as Error)?.message || 'unknown'}`;
    }

    // jawaban kosong (mis. diblokir filter keamanan): biarkan pemanggil beralih ke Groq
    if (!sentAny && !collectedCalls.length) return 'Gemini tidak mengembalikan jawaban.';

    send({ type: 'done', message: { role: 'assistant', content: fullContent, tool_calls: collectedCalls } });
    return null;
  };

  if (useGroq) {
    return ndjson(async (send) => {
      let err = await runGroq(send, selectedModel);
      // Groq habis total: cadangan terakhir ke Gemini
      if (err && !req.signal.aborted && googleAuth) {
        console.warn('[AgentRoute] Groq gagal, dialihkan ke Gemini:', err);
        send({ type: 'wait', seconds: 1, notice: `Groq tidak tersedia, dialihkan ke ${DEFAULT_MODEL_ID}…` });
        err = await runGemini(send, googleAuth, DEFAULT_MODEL_ID);
      }
      if (err && !req.signal.aborted) send({ type: 'error', error: err });
    });
  }

  return ndjson(async (send) => {
    let err = googleAuth ? await runGemini(send, googleAuth, selectedModel) : authErr;
    if (err && !req.signal.aborted && groqReady()) {
      console.warn('[AgentRoute] Gemini gagal, dialihkan ke Groq:', err);
      send({ type: 'wait', seconds: 1, notice: `Gemini tidak tersedia, dialihkan ke ${GROQ_FALLBACK_MODELS[0]}…` });
      err = await runGroq(send, GROQ_FALLBACK_MODELS[0]);
    }
    if (err && !req.signal.aborted) send({ type: 'error', error: err });
  });
}
