'use client';

/* Fitur audio agen: rekam suara dengan deteksi bicara adaptif → transkripsi (/api/agent/transcribe),
   dan bacakan balasan dengan speechSynthesis bawaan browser. */
import * as React from 'react';
import { backendFetch } from '@/lib/backend';

type RecState = 'idle' | 'recording' | 'transcribing';
/** fase saat merekam: menunggu suara atau pengguna sedang berbicara */
type Phase = 'listening' | 'speaking';

/* Teks langsung saat berbicara memakai SpeechRecognition bawaan browser (Chrome/Edge/Safari).
   Hasil akhirnya tetap dirapikan server (Whisper + kosakata TB Guard); bila browser tidak mendukung,
   fitur langsung dilewati dan perekaman berjalan seperti biasa. */
interface SpeechAlt { transcript: string }
interface SpeechRes { isFinal: boolean; 0: SpeechAlt; length: number }
interface SpeechEvt { resultIndex: number; results: ArrayLike<SpeechRes> }
interface SpeechRec {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onresult: ((e: SpeechEvt) => void) | null; onerror: ((e: unknown) => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
}
type SpeechRecCtor = new () => SpeechRec;
const speechCtor = (): SpeechRecCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecCtor; webkitSpeechRecognition?: SpeechRecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export interface TranscribeMeta { language?: string; confidence?: number; engine?: string }

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
}

/* Parameter VAD (voice activity detection) adaptif */
const FRAME_MS = 50;
const CALIBRATE_MS = 500; // ukur derau latar sebelum menilai suara
const START_FRAMES = 3; // ~150 ms di atas ambang = mulai bicara
const MAX_WAIT_MS = 9000; // tidak ada suara sama sekali -> berhenti
const MAX_REC_MS = 60000;
const rmsOf = (buf: Float32Array) => { let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; return Math.sqrt(s / buf.length); };

/** rekam dari mikrofon dengan deteksi bicara otomatis: mulai terdeteksi saat suara melewati ambang adaptif
 *  (menyesuaikan derau ruangan), berhenti sendiri setelah jeda bicara, dan tidak mengirim rekaman kosong. */
export function useRecorder(onText: (text: string, meta?: TranscribeMeta) => void, onError: (msg: string) => void, onInterim?: (text: string) => void) {
  const [state, setState] = React.useState<RecState>('idle');
  const [phase, setPhase] = React.useState<Phase>('listening');
  const [level, setLevel] = React.useState(0);
  const [seconds, setSeconds] = React.useState(0);
  const rec = React.useRef<MediaRecorder | null>(null);
  const cancelled = React.useRef(false);
  const stopVad = React.useRef<() => void>(() => {});
  const heard = React.useRef(false);
  const cb = React.useRef({ onText, onError, onInterim });
  React.useEffect(() => { cb.current = { onText, onError, onInterim }; });
  const speech = React.useRef<SpeechRec | null>(null);

  React.useEffect(() => {
    if (state !== 'recording') return;
    const t0 = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - t0) / 1000)), 250);
    return () => clearInterval(id);
  }, [state]);
  // lepas mikrofon bila komponen dilepas saat merekam
  React.useEffect(() => () => { cancelled.current = true; stopVad.current(); rec.current?.stop(); speech.current?.abort(); }, []);

  const supported = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

  const start = async () => {
    if (state !== 'idle') return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch {
      cb.current.onError('Akses mikrofon ditolak. Izinkan mikrofon di pengaturan browser.'); return;
    }
    const mime = pickMime();
    const r = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 });
    const chunks: Blob[] = [];
    cancelled.current = false;
    heard.current = false;
    r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

    // ---- teks langsung ----
    const Ctor = cb.current.onInterim ? speechCtor() : null;
    if (Ctor) {
      try {
        const sr = new Ctor();
        sr.lang = 'id-ID'; sr.continuous = true; sr.interimResults = true; sr.maxAlternatives = 1;
        sr.onresult = (e) => {
          let t = '';
          for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
          cb.current.onInterim?.(t.trim());
        };
        sr.onerror = () => { /* tidak ada suara / izin ditolak: perekam tetap jalan tanpa teks langsung */ };
        sr.start();
        speech.current = sr;
      } catch { speech.current = null; }
    }

    // ---- VAD adaptif ----
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const t0 = Date.now();
    let noise = 0, calibN = 0, above = 0, speaking = false, speechStart = 0, silenceFrom = 0, lastLevelAt = 0;
    const vad = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      const rms = rmsOf(buf), now = Date.now(), elapsed = now - t0;
      if (now - lastLevelAt > 90) { lastLevelAt = now; setLevel(Math.min(1, rms * 9)); }
      if (elapsed < CALIBRATE_MS) { noise = (noise * calibN + rms) / (calibN + 1); calibN++; return; }
      const high = Math.max(noise * 3, noise + 0.012, 0.015); // ambang mulai bicara
      const low = high * 0.55; // histeresis: ambang berhenti
      if (!speaking) {
        noise = noise * 0.96 + Math.min(rms, high) * 0.04; // derau latar ikut menyesuaikan
        above = rms > high ? above + 1 : 0;
        if (above >= START_FRAMES) { speaking = true; heard.current = true; speechStart = now; silenceFrom = 0; setPhase('speaking'); }
        else if (elapsed > MAX_WAIT_MS) { clearInterval(vad); r.stop(); }
      } else if (rms < low) {
        silenceFrom ||= now;
        // ucapan panjang diberi jeda lebih longgar (orang berpikir di tengah kalimat)
        const gap = Math.min(1900, 1000 + (now - speechStart) * 0.08);
        if (now - silenceFrom > gap) { clearInterval(vad); r.stop(); }
      } else silenceFrom = 0;
      if (elapsed > MAX_REC_MS) { clearInterval(vad); r.stop(); }
    }, FRAME_MS);
    stopVad.current = () => { clearInterval(vad); void ctx.close().catch(() => {}); setLevel(0); };

    r.onstop = async () => {
      stopVad.current();
      try { speech.current?.stop(); } catch { /* sudah berhenti */ }
      speech.current = null;
      stream.getTracks().forEach((t) => t.stop());
      rec.current = null;
      if (cancelled.current || !chunks.length) { setState('idle'); return; }
      // tanpa ucapan: jangan buang kuota transkripsi
      if (!heard.current) { cb.current.onError('Tidak ada suara terdeteksi. Coba bicara lebih dekat ke mikrofon.'); setState('idle'); return; }
      setState('transcribing');
      try {
        const type = r.mimeType || 'audio/webm';
        const ext = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm';
        const fd = new FormData();
        fd.append('audio', new File(chunks, `suara.${ext}`, { type }));
        fd.append('duration', String(Math.round((Date.now() - t0) / 100) / 10));
        const res = await backendFetch('/api/agent/transcribe', { method: 'POST', body: fd });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || `Transkripsi gagal (HTTP ${res.status})`);
        if (j.text) cb.current.onText(j.text, { language: j.language, confidence: j.confidence, engine: j.engine });
        else cb.current.onError('Suara tidak terdengar jelas, coba lagi.');
      } catch (e) {
        cb.current.onError(e instanceof Error ? e.message : String(e));
      } finally { setState('idle'); }
    };
    rec.current = r;
    r.start(250);
    setSeconds(0);
    setPhase('listening');
    setState('recording');
  };
  const stop = () => rec.current?.stop();
  const cancel = () => { cancelled.current = true; rec.current?.stop(); };

  return { state, phase, level, seconds, supported, start, stop, cancel };
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
