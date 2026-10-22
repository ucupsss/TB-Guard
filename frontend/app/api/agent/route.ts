/* Proxy agen AI bertenaga Google Gemini & Groq Cloud (Multi-Model & Key Auto-Rotation).
   Mendukung pergantian model dinamis: Gemini 2.5 Flash, Llama 3.3 70B, DeepSeek R1 Distill, Mixtral, Qwen, dll.
   Dilengkapi hot-reload & auto-rotation 85+ API key Groq serta optimasi kompresi token super hemat. */

import { TOOLS } from '@/lib/agent/tools';
import { systemPrompt, type AgentContext } from '@/lib/agent/prompt';
import { groqPool } from '@/lib/agent/groq-keys';
import { isGroqModel, DEFAULT_MODEL_ID } from '@/lib/agent/models';
import { getGoogleGeminiAuth, normalizeVertexModel } from '@/lib/agent/google-auth';

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

  // =========================================================================
  // ALUR 1: GROQ CLOUD (Llama 3.3, DeepSeek R1, Mixtral, Qwen, dll.)
  // Didukung Auto-Rotation 85+ API Keys & Hot-Reload jika terkena rate limit
  // =========================================================================
  if (useGroq) {
    const keyInfo = groqPool.getActiveKey();
    if (!keyInfo) {
      return Response.json(
        { error: 'Tidak ada API Key Groq yang tersedia di groq_keys.txt atau environment.' },
        { status: 500 }
      );
    }

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
          content: m.content || null,
          tool_calls: m.tool_calls,
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

    const stream = new ReadableStream({
      async start(ctl) {
        const send = (e: object) => ctl.enqueue(enc.encode(JSON.stringify(e) + '\n'));
        const MAX_KEY_RETRIES = 5;
        let attempts = 0;
        let success = false;

        while (attempts < MAX_KEY_RETRIES && !success && !req.signal.aborted) {
          attempts++;
          const currentKey = groqPool.getActiveKey();
          if (!currentKey) {
            send({ type: 'error', error: 'Semua API key Groq sedang cooldown. Coba lagi dalam 30 detik.' });
            break;
          }

          try {
            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${currentKey.key}`,
              },
              body: JSON.stringify({
                model: selectedModel,
                messages: openAiMsgs,
                tools: groqTools,
                tool_choice: 'auto',
                temperature: 0.3,
                max_tokens: 1536,
                stream: true,
              }),
              signal: req.signal,
            });

            if (groqRes.status === 429 || groqRes.status === 413) {
              groqPool.markRateLimited(currentKey.key, 60);
              send({
                type: 'wait',
                seconds: 1,
                notice: `Rotasi API Key Groq [${currentKey.index}/${currentKey.total}] karena limit kuota...`,
              });
              continue;
            }

            if (!groqRes.ok) {
              const errText = await groqRes.text();
              let parsedErr = errText;
              try {
                parsedErr = JSON.parse(errText).error?.message || errText;
              } catch {
                // abaikan
              }

              // Jika model tidak tersedia atau rate limit, rotasi atau lempar error
              if (groqRes.status >= 500 || groqRes.status === 400 && parsedErr.includes('rate_limit')) {
                groqPool.markRateLimited(currentKey.key, 30);
                continue;
              }

              send({ type: 'error', error: `Groq API Error (${groqRes.status}): ${parsedErr}` });
              break;
            }

            const reader = groqRes.body?.getReader();
            if (!reader) {
              send({ type: 'error', error: 'Response stream Groq tidak tersedia' });
              break;
            }

            success = true;
            const dec = new TextDecoder();
            let buffer = '';
            let fullContent = '';
            const toolCallsByIndex: Record<number, { id: string; name: string; args: string }> = {};

            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += dec.decode(value, { stream: true });

              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const jsonStr = trimmed.slice(5).trim();
                if (jsonStr === '[DONE]') continue;
                if (!jsonStr) continue;

                try {
                  const data = JSON.parse(jsonStr);
                  const delta = data.choices?.[0]?.delta;
                  if (!delta) continue;

                  // Reasoning support (DeepSeek R1 reasoning_content)
                  if (delta.reasoning_content || delta.reasoning) {
                    send({ type: 'reasoning', delta: delta.reasoning_content || delta.reasoning });
                  }

                  // Content streaming
                  if (typeof delta.content === 'string' && delta.content) {
                    fullContent += delta.content;
                    send({ type: 'content', delta: delta.content });
                  }

                  // Tool calls streaming
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
              }
            }

            const collectedCalls: InToolCall[] = Object.values(toolCallsByIndex)
              .filter((tc) => tc.name)
              .map((tc) => ({
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.name,
                  arguments: tc.args || '{}',
                },
              }));

            send({
              type: 'done',
              message: {
                role: 'assistant',
                content: fullContent,
                tool_calls: collectedCalls,
              },
            });
          } catch (err: unknown) {
            if (!req.signal.aborted) {
              const e = err as Error;
              send({ type: 'error', error: e.message || 'Koneksi ke Groq terputus' });
            }
          }
        }
        ctl.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  // =========================================================================
  // ALUR 2: GOOGLE GEMINI (Vertex AI Google Cloud & Generative Language API)
  // Kompatibel dengan GCP Service Account (Vercel, Cloud Run, Local Dev)
  // =========================================================================
  let googleAuth;
  try {
    googleAuth = await getGoogleGeminiAuth();
  } catch (err: unknown) {
    const e = err as Error;
    return Response.json(
      {
        error:
          e.message ||
          'Kredensial Google Cloud Vertex AI atau GEMINI_API_KEY belum tersedia.',
      },
      { status: 500 }
    );
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
        parts: [{ text: typeof m.content === 'string' ? m.content : '' }],
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

  if (googleAuth.mode === 'vertex') {
    const vertexModel = normalizeVertexModel(selectedModel);
    geminiUrl = `https://${googleAuth.location}-aiplatform.googleapis.com/v1/projects/${googleAuth.projectId}/locations/${googleAuth.location}/publishers/google/models/${vertexModel}:streamGenerateContent?alt=sse`;
    headers['Authorization'] = `Bearer ${googleAuth.token}`;
  } else {
    geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:streamGenerateContent?key=${googleAuth.apiKey}&alt=sse`;
  }

  const stream = new ReadableStream({
    async start(ctl) {
      const send = (e: object) => ctl.enqueue(enc.encode(JSON.stringify(e) + '\n'));

      try {
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: req.signal,
        });

        if (!response.ok) {
          const errText = await response.text();
          let parsedErr = errText;
          try {
            parsedErr = JSON.parse(errText).error?.message || errText;
          } catch {
            // abaikan
          }
          send({ type: 'error', error: `Gemini API Error (${response.status}): ${parsedErr}` });
          ctl.close();
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          send({ type: 'error', error: 'Response stream tidak tersedia' });
          ctl.close();
          return;
        }

        const dec = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        const collectedCalls: InToolCall[] = [];

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += dec.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr);
              const candidate = data.candidates?.[0];
              const parts = candidate?.content?.parts;

              if (Array.isArray(parts)) {
                for (const part of parts) {
                  if (typeof part.text === 'string' && part.text) {
                    if (part.thought) {
                      send({ type: 'reasoning', delta: part.text });
                    } else {
                      fullContent += part.text;
                      send({ type: 'content', delta: part.text });
                    }
                  }

                  if (part.functionCall) {
                    const callId = 'call_' + Math.random().toString(36).slice(2, 10);
                    collectedCalls.push({
                      id: callId,
                      type: 'function',
                      function: {
                        name: part.functionCall.name,
                        arguments: JSON.stringify(part.functionCall.args || {}),
                      },
                    });
                  }
                }
              }
            } catch {
              // abaikan
            }
          }
        }

        send({
          type: 'done',
          message: {
            role: 'assistant',
            content: fullContent,
            tool_calls: collectedCalls,
          },
        });
      } catch (err: unknown) {
        if (!req.signal.aborted) {
          const e = err as Error;
          send({ type: 'error', error: e.message || 'Terjadi kesalahan pada Gemini AI Agent' });
        }
      } finally {
        ctl.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
