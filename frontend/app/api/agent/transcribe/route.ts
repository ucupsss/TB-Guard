/* Transkripsi suara untuk input mic agen menggunakan Google Gemini API (Multimodal Audio STT).
   Client mengirim multipart form berisi `audio`, server membalas {text}. API key tetap di server. */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(req: Request) {
  if (!GEMINI_API_KEY) {
    return Response.json(
      { error: 'GEMINI_API_KEY belum dikonfigurasi di environment' },
      { status: 500 }
    );
  }

  let audio: FormDataEntryValue | null;
  try {
    audio = (await req.formData()).get('audio');
  } catch {
    return Response.json({ error: 'Body bukan multipart form' }, { status: 400 });
  }

  if (!(audio instanceof File) || !audio.size) {
    return Response.json({ error: 'Rekaman suara kosong' }, { status: 400 });
  }

  if (audio.size > MAX_BYTES) {
    return Response.json({ error: 'Ukuran rekaman audio melebihi batas (20MB)' }, { status: 413 });
  }

  try {
    // Konversi audio file ke Base64 untuk payload inlineData Gemini
    const arrayBuffer = await audio.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = audio.type || 'audio/webm';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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

    if (!res.ok) {
      const errText = await res.text();
      console.error('Gemini STT API error:', res.status, errText);
      return Response.json(
        { error: `Gemini STT error: HTTP ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const transcribedText =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    return Response.json({ text: transcribedText });
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error('Transcribe error:', err);
    return Response.json(
      { error: err.message || 'Gagal mentranskripsi suara dengan Gemini' },
      { status: 502 }
    );
  }
}
