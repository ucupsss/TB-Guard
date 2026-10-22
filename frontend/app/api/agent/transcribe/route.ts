/* Transkripsi suara untuk input mic agen menggunakan:
   1. Groq Whisper (whisper-large-v3-turbo) via pool 85+ API keys (sangat cepat & akurat untuk bahasa Indonesia)
   2. Google Cloud Vertex AI (Gemini 2.5 Flash via Service Account / ADC)
   3. Google AI Studio (jika GEMINI_API_KEY tersedia di environment)
   Client mengirim multipart form berisi `audio`, server membalas {text}. */

import Groq, { toFile } from 'groq-sdk';
import { groqPool } from '@/lib/agent/groq-keys';
import { getGoogleGeminiAuth } from '@/lib/agent/google-auth';

const MAX_BYTES = 25 * 1024 * 1024;

export const maxDuration = 60;

export async function POST(req: Request) {
  let audio: FormDataEntryValue | null;
  try {
    const formData = await req.formData();
    audio = formData.get('audio');
  } catch {
    return Response.json({ error: 'Body bukan multipart form' }, { status: 400 });
  }

  if (!(audio instanceof File) || !audio.size) {
    return Response.json({ error: 'Rekaman suara kosong' }, { status: 400 });
  }

  if (audio.size > MAX_BYTES) {
    return Response.json({ error: 'Ukuran rekaman audio melebihi batas (25MB)' }, { status: 413 });
  }

  const arrayBuffer = await audio.arrayBuffer();
  const mimeType = audio.type || 'audio/webm';
  const audioBuffer = Buffer.from(arrayBuffer);

  // ==========================================
  // JALUR 1: GROQ WHISPER (whisper-large-v3-turbo)
  // Sangat cepat (~200ms) dan akurat bahasa Indonesia
  // ==========================================
  const maxRetries = Math.min(10, groqPool.getStats().total || 5);
  for (let i = 0; i < maxRetries; i++) {
    const active = groqPool.getActiveKey();
    if (!active) break;
    const apiKey = active.key;

    try {
      const groq = new Groq({ apiKey });
      const groqFile = await toFile(audioBuffer, 'voice.webm', { type: mimeType });
      const res = await groq.audio.transcriptions.create({
        file: groqFile,
        model: 'whisper-large-v3-turbo',
        language: 'id',
        temperature: 0.1,
      });

      if (res && res.text) {
        return Response.json({ text: res.text.trim() });
      }
    } catch (err: unknown) {
      const gErr = err as { status?: number; message?: string };
      console.warn(`[Transcribe/Groq] Key gagal (status ${gErr?.status || 'unknown'}):`, gErr?.message || err);

      if (gErr?.status === 400 || gErr?.status === 401 || gErr?.status === 403) {
        groqPool.markInvalid(apiKey);
      } else {
        groqPool.markRateLimited(apiKey, 45);
      }
    }
  }

  // ==========================================
  // JALUR 2: GOOGLE CLOUD VERTEX AI (Gemini 2.5 Flash via ADC/Service Account)
  // ==========================================
  try {
    const auth = await getGoogleGeminiAuth();
    if (auth && auth.token && auth.projectId) {
      const base64Audio = audioBuffer.toString('base64');
      const vertexUrl = `https://${auth.location}-aiplatform.googleapis.com/v1/projects/${auth.projectId}/locations/${auth.location}/publishers/google/models/gemini-2.5-flash:generateContent`;

      const res = await fetch(vertexUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Audio,
                  },
                },
                {
                  text: 'Transkripsikan rekaman audio bahasa Indonesia ini secara persis dan akurat ke teks percakapan. Keluarkan HANYA teks hasil transkripsinya saja, tanpa tanda petik, tanpa awalan, dan tanpa penjelasan tambahan.',
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
          },
        }),
        signal: req.signal,
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        if (text) {
          return Response.json({ text });
        }
      }
    }
  } catch (err) {
    console.warn('[Transcribe/VertexAI] Fallback Vertex gagal:', err);
  }

  // ==========================================
  // JALUR 3: GOOGLE AI STUDIO (GEMINI_API_KEY)
  // ==========================================
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiApiKey) {
    try {
      const base64Audio = audioBuffer.toString('base64');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Audio,
                  },
                },
                {
                  text: 'Transkripsikan rekaman audio bahasa Indonesia ini secara persis dan akurat ke teks percakapan. Keluarkan HANYA teks hasil transkripsinya saja, tanpa tanda petik, tanpa awalan, dan tanpa penjelasan tambahan.',
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
          },
        }),
        signal: req.signal,
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        if (text) {
          return Response.json({ text });
        }
      }
    } catch (err) {
      console.warn('[Transcribe/GeminiStudio] Fallback Studio gagal:', err);
    }
  }

  return Response.json(
    { error: 'Semua layanan transkripsi (Groq Whisper, Vertex AI, Gemini) sedang sibuk. Coba sesaat lagi.' },
    { status: 503 }
  );
}
