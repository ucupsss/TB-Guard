/* Transkripsi suara untuk input agen (Groq Whisper). Client mengirim multipart form berisi `audio`,
   server membalas {text}. API key tetap di server. */
import Groq from 'groq-sdk';

const MODEL = process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo';
const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(req: Request) {
  if (!process.env.GROQ_API_KEY) return Response.json({ error: 'GROQ_API_KEY belum diatur di frontend/.env' }, { status: 500 });
  let audio: FormDataEntryValue | null;
  try { audio = (await req.formData()).get('audio'); } catch { return Response.json({ error: 'Body bukan multipart form' }, { status: 400 }); }
  if (!(audio instanceof File) || !audio.size) return Response.json({ error: 'Rekaman kosong' }, { status: 400 });
  if (audio.size > MAX_BYTES) return Response.json({ error: 'Rekaman terlalu panjang' }, { status: 413 });

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const r = await groq.audio.transcriptions.create({ file: audio, model: MODEL, language: 'id', response_format: 'json', temperature: 0 }, { signal: req.signal });
    return Response.json({ text: (r.text || '').trim() });
  } catch (e) {
    const err = e as { status?: number; message?: string; error?: { error?: { message?: string } } };
    return Response.json({ error: err.error?.error?.message || err.message || 'Gagal mentranskripsi suara' }, { status: err.status || 502 });
  }
}
