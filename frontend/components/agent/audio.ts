'use client';

/* Fitur audio agen: rekam suara → transkripsi (/api/agent/transcribe), dan bacakan balasan
   dengan speechSynthesis bawaan browser. */
import * as React from 'react';

type RecState = 'idle' | 'recording' | 'transcribing';

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
}

/** rekam dari mikrofon; `stop()` mengirim rekaman ke server lalu memanggil onText dengan hasilnya */
export function useRecorder(onText: (text: string) => void, onError: (msg: string) => void) {
  const [state, setState] = React.useState<RecState>('idle');
  const [seconds, setSeconds] = React.useState(0);
  const rec = React.useRef<MediaRecorder | null>(null);
  const cancelled = React.useRef(false);
  const cb = React.useRef({ onText, onError });
  React.useEffect(() => { cb.current = { onText, onError }; });

  React.useEffect(() => {
    if (state !== 'recording') return;
    const t0 = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - t0) / 1000)), 250);
    return () => clearInterval(id);
  }, [state]);
  // lepas mikrofon bila komponen dilepas saat merekam
  React.useEffect(() => () => { cancelled.current = true; rec.current?.stop(); }, []);

  const supported = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

  const start = async () => {
    if (state !== 'idle') return;
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch {
      cb.current.onError('Akses mikrofon ditolak. Izinkan mikrofon di pengaturan browser.'); return;
    }
    const mime = pickMime();
    const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    cancelled.current = false;
    r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    r.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      rec.current = null;
      if (cancelled.current || !chunks.length) { setState('idle'); return; }
      setState('transcribing');
      try {
        const type = r.mimeType || 'audio/webm';
        const ext = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm';
        const fd = new FormData();
        fd.append('audio', new File(chunks, `suara.${ext}`, { type }));
        const res = await fetch('/api/agent/transcribe', { method: 'POST', body: fd });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || `Transkripsi gagal (HTTP ${res.status})`);
        if (j.text) cb.current.onText(j.text); else cb.current.onError('Suara tidak terdengar jelas, coba lagi.');
      } catch (e) {
        cb.current.onError(e instanceof Error ? e.message : String(e));
      } finally { setState('idle'); }
    };
    rec.current = r;
    r.start();
    setSeconds(0);
    setState('recording');
  };
  const stop = () => rec.current?.stop();
  const cancel = () => { cancelled.current = true; rec.current?.stop(); };

  return { state, seconds, supported, start, stop, cancel };
}

/* ---- text-to-speech: satu pembicara global supaya hanya satu balasan dibacakan sekaligus ---- */
let speakingId: string | null = null;
const listeners = new Set<() => void>();
const emit = (id: string | null) => { speakingId = id; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

/** buang sintaks markdown supaya tidak ikut dibacakan */
function plain(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, '')
    .replace(/\|/g, ', ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/[*_~>#]/g, '')
    .replace(/\n{2,}/g, '. ')
    .trim();
}

function voiceFor(lang: string) {
  const vs = window.speechSynthesis.getVoices();
  return vs.find((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase()) ?? vs.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2)));
}

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(id: string, md: string) {
  if (!ttsSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const text = plain(md);
  if (!text) { emit(null); return; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'id-ID';
  const v = voiceFor('id-ID');
  if (v) u.voice = v;
  u.onend = u.onerror = () => { if (speakingId === id) emit(null); };
  emit(id);
  synth.speak(u);
}

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel();
  emit(null);
}

/** id balasan yang sedang dibacakan (null bila diam) */
export const useSpeakingId = () => React.useSyncExternalStore(subscribe, () => speakingId, () => null);
