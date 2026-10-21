/* Proxy agen AI bertenaga Google Gemini 2.5 Flash.
   Client mengirim riwayat pesan; server menambah system prompt + definisi tool Gemini,
   lalu men-stream balik event NDJSON: {type:'reasoning'|'content', delta} ... {type:'done', message} atau {type:'error', error}. */

import { TOOLS } from '@/lib/agent/tools';
import { systemPrompt, type AgentContext } from '@/lib/agent/prompt';

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

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

/** Bersihkan skema parameter agar valid 100% untuk Google Gemini Tool API */
function cleanSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (k === 'type') {
      if (Array.isArray(v)) {
        const types = v.map((t) => String(t).toUpperCase());
        if (types.includes('NULL')) {
          const nonNull = types.find((t) => t !== 'NULL') || 'STRING';
          out.type = nonNull;
          out.nullable = true;
        } else {
          out.type = types[0];
        }
      } else {
        out.type = String(v).toUpperCase();
      }
    } else if (k === 'properties' && v && typeof v === 'object') {
      const props: Record<string, unknown> = {};
      for (const [propName, propVal] of Object.entries(v as Record<string, unknown>)) {
        props[propName] = cleanSchema(propVal);
      }
      out.properties = props;
    } else if (k === 'items') {
      out.items = cleanSchema(v);
    } else if (k === 'enum' && Array.isArray(v)) {
      const filtered = v.filter((x) => x !== null && x !== undefined && String(x).trim() !== '').map(String);
      if (filtered.length > 0) out.enum = filtered;
    } else {
      out[k] = v;
    }
  }
  return out;
}

const functionDeclarations = TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  parameters: cleanSchema(t.parameters),
}));

export async function POST(req: Request) {
  if (!API_KEY) {
    return Response.json({ error: 'GEMINI_API_KEY belum dikonfigurasi.' }, { status: 500 });
  }

  let body: { messages?: InMessage[]; context?: AgentContext };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Body bukan JSON' }, { status: 400 });
  }

  const rawMsgs = Array.isArray(body.messages) ? body.messages : [];
  if (!rawMsgs.length) {
    return Response.json({ error: 'Pesan kosong' }, { status: 400 });
  }

  // Peta ID tool call -> nama fungsi agar respons tool dapat dipasangkan dengan tepat
  const toolNameMap = new Map<string, string>();
  for (const m of rawMsgs) {
    if (m.tool_calls) {
      for (const tc of m.tool_calls) {
        if (tc.id && tc.function?.name) {
          toolNameMap.set(tc.id, tc.function.name);
        }
      }
    }
  }

  // Format pesan ke format `contents` Google Gemini API
  type GeminiPart =
    | { text: string; thought?: boolean }
    | { functionCall: { name: string; args: Record<string, unknown> } }
    | { functionResponse: { name: string; response: Record<string, unknown> } };

  interface GeminiContent {
    role: 'user' | 'model';
    parts: GeminiPart[];
  }

  const contents: GeminiContent[] = [];

  for (const m of rawMsgs) {
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
        parsedResponse = typeof m.content === 'string' ? JSON.parse(m.content) : m.content;
      } catch {
        parsedResponse = { output: m.content };
      }

      const responsePart: GeminiPart = {
        functionResponse: {
          name: fnName,
          response: { result: parsedResponse },
        },
      };

      // Jika pesan terakhir di contents sudah ber-role 'user', gabungkan functionResponse ke dalamnya
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

  // Siapkan payload request ke Gemini
  const sysText = systemPrompt(body.context || {});
  const payload = {
    systemInstruction: {
      parts: [{ text: sysText }],
    },
    contents,
    tools: [
      {
        functionDeclarations,
      },
    ],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 2048,
    },
  };

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?key=${API_KEY}&alt=sse`;

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctl) {
      const send = (e: object) => ctl.enqueue(enc.encode(JSON.stringify(e) + '\n'));

      try {
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: req.signal,
        });

        if (!response.ok) {
          const errText = await response.text();
          let parsedErr = errText;
          try {
            const j = JSON.parse(errText);
            parsedErr = j.error?.message || errText;
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
                  // Text streaming
                  if (typeof part.text === 'string' && part.text) {
                    if (part.thought) {
                      send({ type: 'reasoning', delta: part.text });
                    } else {
                      fullContent += part.text;
                      send({ type: 'content', delta: part.text });
                    }
                  }

                  // Function/Tool Call detection
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
              // abaikan chunk yang belum utuh
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
