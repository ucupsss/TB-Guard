'use client';

import * as React from 'react';
import {
  ActivityLogIcon, BookmarkIcon, CheckCircledIcon, ExclamationTriangleIcon, PauseIcon, PlayIcon, ReloadIcon,
  SpeakerLoudIcon, StopIcon, UpdateIcon, VideoIcon,
} from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  classifyLiveAudioBlob,
  type LiveClassificationResult,
} from '@/lib/ai-service';
import { LiveCoughSpectrogram } from '@/components/tb/LiveCoughSpectrogram';
import { MicIcon } from '@/components/tb/icons';
import { CoughSourceFrame } from '@/components/tb/CoughSourceFrame';
import { Switch } from '@/components/ui/switch';
import { fuseDoa, useCoughCamera, type Attribution } from '@/lib/cough-vision';
import { analyzeStereo, type RawCapture } from '@/lib/doa';
import { RawRecorder } from '@/lib/doa-capture';
import { DoaPanel } from '@/components/tb/DoaPanel';
import { useStore } from '@/lib/store';
import { uploadRecording } from '@/lib/uploads';
import { cn } from '@/lib/utils';

// Helper: Convert Float32Array PCM buffer to a 16-bit PCM WAV Blob (16 kHz mono)
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const channelData = buffer.getChannelData(0);
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = channelData.length * bytesPerSample;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < channelData.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export function LiveMicRecorder() {
  const { addDetection, devices } = useStore();
  const [hasMicPermission, setHasMicPermission] = React.useState<boolean | null>(null);
  const [isRecording, setIsRecording] = React.useState(false);
  const [countdown, setCountdown] = React.useState<number>(0);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [audioBlob, setAudioBlob] = React.useState<Blob | null>(null);
  const [decodedBuffer, setDecodedBuffer] = React.useState<AudioBuffer | null>(null);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [result, setResult] = React.useState<LiveClassificationResult | null>(null);
  const [volumeLevel, setVolumeLevel] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const { videoRef: camVideoRef, state: camState, error: camError, start: camStart, stop: camStop, begin: camBegin, finish: camFinish } = useCoughCamera({ autoStart: true });
  const [att, setAtt] = React.useState<Attribution | null>(null);
  const [blurFaces, setBlurFaces] = React.useState(false);
  // arah suara (GCC-PHAT) dari PCM mentah 2 kanal mic laptop
  const rawRecRef = React.useRef<RawRecorder | null>(null);
  const [raw, setRaw] = React.useState<RawCapture | null>(null);
  const [micCm, setMicCm] = React.useState(10);
  const [swapCh, setSwapCh] = React.useState(false);
  const stereo = React.useMemo(() => (raw ? analyzeStereo(raw, micCm / 100, swapCh) : null), [raw, micCm, swapCh]);
  const doaSigma = 15;
  const shownAtt = React.useMemo(() => (att && stereo?.ok ? fuseDoa(att, stereo.azimuth, doaSigma) : att), [att, stereo]);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const animFrameRef = React.useRef<number | null>(null);
  const audioPlayerRef = React.useRef<HTMLAudioElement | null>(null);

  // Initialize Microphone stream & visualizer
  const startMicMonitoring = async () => {
    try {
      // Clean up previous stream and context if still hanging
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { await audioContextRef.current.close(); } catch {}
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000,
          channelCount: { ideal: 2 },
        },
      });

      mediaStreamRef.current = stream;
      rawRecRef.current?.close();
      rawRecRef.current = await RawRecorder.create(stream).catch(() => null);
      setHasMicPermission(true);

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Draw real-time waveform on canvas
      const draw = () => {
        if (!canvasRef.current || !analyserRef.current) return;
        const canvas = canvasRef.current;
        const cCtx = canvas.getContext('2d');
        if (!cCtx) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteTimeDomainData(dataArray);

        // Compute volume level
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / bufferLength);
        setVolumeLevel(Math.min(100, Math.round(rms * 250)));

        cCtx.fillStyle = '#0f172a';
        cCtx.fillRect(0, 0, canvas.width, canvas.height);

        cCtx.lineWidth = 2.5;
        cCtx.strokeStyle = '#38bdf8';
        cCtx.beginPath();

        const sliceWidth = (canvas.width * 1.0) / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * canvas.height) / 2;

          if (i === 0) {
            cCtx.moveTo(x, y);
          } else {
            cCtx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        cCtx.lineTo(canvas.width, canvas.height / 2);
        cCtx.stroke();

        animFrameRef.current = requestAnimationFrame(draw);
      };

      draw();
    } catch (err) {
      console.error('Microphone access denied or error:', err);
      setHasMicPermission(false);
      toast.error('Akses mikrofon ditolak atau tidak ditemukan di perangkat Anda.');
    }
  };

  React.useEffect(() => {
    let alive = true;

    // Check if permission was already given previously in this browser session
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((pStatus) => {
          if (alive && pStatus.state === 'granted') {
            startMicMonitoring();
          }
        })
        .catch(() => {});
    }

    // Automatically recover microphone when switching between browser tabs or windows
    const handleTabSwitch = async () => {
      if (document.visibilityState === 'visible' && alive) {
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          try {
            await audioContextRef.current.resume();
          } catch {}
        }
        const activeTrack = mediaStreamRef.current?.getAudioTracks()[0];
        if (!activeTrack || activeTrack.readyState !== 'live') {
          await startMicMonitoring();
        }
      }
    };

    document.addEventListener('visibilitychange', handleTabSwitch);
    window.addEventListener('focus', handleTabSwitch);

    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', handleTabSwitch);
      window.removeEventListener('focus', handleTabSwitch);
      rawRecRef.current?.close();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Record 3-second audio sample from the microphone
  const handleRecord = async () => {
    const activeTrack = mediaStreamRef.current?.getAudioTracks()[0];
    if (!mediaStreamRef.current || !activeTrack || activeTrack.readyState !== 'live' || !audioContextRef.current) {
      await startMicMonitoring();
      if (!mediaStreamRef.current) return;
    }

    if (audioContextRef.current?.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
      } catch {}
    }

    setIsRecording(true);
    setResult(null);
    setAtt(null);
    setRaw(null);
    setAudioUrl(null);
    setAudioBlob(null);
    setDecodedBuffer(null);

    const RECORD_SECONDS = 3;
    setCountdown(RECORD_SECONDS);

    const stream = mediaStreamRef.current!;
    const ctx = audioContextRef.current!;
    const sampleRate = ctx.sampleRate;

    // Use MediaRecorder or ScriptProcessor to capture PCM
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.start();
    camBegin();
    rawRecRef.current?.begin();

    // Timer countdown
    let remaining = RECORD_SECONDS;
    const timer = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        recorder.stop();
      }
    }, 1000);

    recorder.onstop = async () => {
      setIsRecording(false);
      setAnalyzing(true);
      try {
        const rawBlob = new Blob(chunks, { type: recorder.mimeType });
        const arrayBuffer = await rawBlob.arrayBuffer();

        // Decode audio data to extract clean 16 kHz WAV
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        setDecodedBuffer(audioBuffer);
        setAtt(camFinish(audioBuffer));
        setRaw(rawRecRef.current?.end() ?? null);
        const wavBlob = audioBufferToWav(audioBuffer);

        const url = URL.createObjectURL(wavBlob);
        setAudioUrl(url);
        setAudioBlob(wavBlob);

        // Run AI ML & LLM Classification
        const classification = await classifyLiveAudioBlob(wavBlob, {
          patient_name: 'Naracoba Laptop / Mic',
          location: 'Live Laptop Mic Test',
          zone: 'Ruang Uji Langsung',
        });

        setResult(classification);
        toast.success('Analisis batuk selesai!');
      } catch (e: any) {
        camFinish(null);
        rawRecRef.current?.end();
        console.error('Classification error:', e);
        toast.error('Gagal memproses audio batuk. Pastikan suara terekam dengan jelas.');
      } finally {
        setAnalyzing(false);
      }
    };
  };

  const togglePlay = () => {
    if (!audioPlayerRef.current) return;
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const [saving, setSaving] = React.useState(false);
  /** audio -> Neon Object Storage, metadata deteksi -> Postgres; keduanya dikaitkan lewat uuid */
  const handleSaveToDashboard = async () => {
    if (!result || !audioBlob || saving) return;
    const dev = devices[0];
    if (!dev) { toast.error('Belum ada perangkat terdaftar untuk menyimpan deteksi.'); return; }
    setSaving(true);
    try {
      let audioSaved = true;
      try { await uploadRecording(audioBlob, result.uuid); } catch (e) {
        audioSaved = false;
        toast.warning(e instanceof Error ? e.message : 'Audio gagal diunggah ke object storage');
      }
      const src = att?.source != null ? att.people[att.source] : null;
      const ok = await addDetection({
        uuid: result.uuid, deviceId: dev.id, time: new Date(result.timestamp_iso).getTime(), type: result.cough_count > 0 ? 'Batuk' : '-',
        result: result.result, confidence: result.confidence, name: '', gender: '', age: '',
        doa: { azimuth: stereo?.ok ? Math.round(stereo.azimuth) : 0, confidence: 0.5, snr: 0, tdoa: [] },
        person: { tracked: !!src, id: src ? 'P1' : '', score: src ? src.score : 0, crowd: att ? Math.max(0, att.people.length - (src ? 1 : 0)) : 0 },
        reviewed: false, coughs: result.cough_count,
      });
      if (ok) toast.success(audioSaved ? `Deteksi ${result.uuid} & audio tersimpan di Neon` : `Deteksi ${result.uuid} tersimpan (audio gagal)`);
      else toast.error('Deteksi gagal disimpan ke database (butuh akses admin).');
    } finally { setSaving(false); }
  };

  const f = result?.acoustic_features;
  const metrics = f ? [
    { k: 'Harmonisitas Glotis', ok: (f.harmonicity ?? 0.4) > 0.3, v: f.harmonicity ? `${(f.harmonicity * 100).toFixed(0)}%` : 'Tonal', okText: 'Jernih (Batuk Biasa)', badText: 'Parau/Turbulen' },
    { k: 'Laju Peluruhan Suara', ok: (f.decay_ratio ?? 0.2) < 0.25, v: f.decay_ratio ? `${(f.decay_ratio * 100).toFixed(0)}%` : 'Cepat', okText: 'Cepat (Normal)', badText: 'Memanjang (TB)' },
    { k: 'Turbulensi Spektral', ok: (f.spectral_flatness ?? 0.3) < 0.35, v: f.spectral_flatness ? `${(f.spectral_flatness * 100).toFixed(0)}%` : 'Rendah', okText: 'Stabil', badText: 'Kaotik' },
    { k: 'Spectral Centroid', ok: null, v: `${f.spectral_centroid_hz} Hz`, okText: 'Pita 1.2 – 3.5 kHz', badText: '' },
  ] : [];

  return (
    <div className="intro-y box p-5">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200/60 pb-5 dark:border-white/10">
        <div className="mr-auto">
          <div className="flex items-center gap-2 font-medium">
            Perekam Batuk
            <Badge variant="soft-primary" title="Sampling 16 kHz · deteksi otomatis batuk TB vs Non-TB">Live AI</Badge>
          </div>
        </div>

        {/* level mikrofon */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <SpeakerLoudIcon className="h-4 w-4" />
          Level Mic
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
            <div className={cn('h-full transition-all duration-75', volumeLevel > 70 ? 'bg-danger' : volumeLevel > 25 ? 'bg-success' : 'bg-primary')} style={{ width: `${volumeLevel}%` }} />
          </div>
          <span className="num w-8 text-right font-medium text-foreground">{volumeLevel}%</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-12 gap-6">
        <div className="col-span-12 space-y-4 lg:col-span-6">
          <div className="relative overflow-hidden rounded-md bg-slate-900">
            <canvas ref={canvasRef} width={500} height={160} className="block h-40 w-full" />

            {!hasMicPermission && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 p-6 text-center text-white">
                <MicIcon className="mb-2 h-6 w-6 text-blue-300" />
                <div className="font-medium">Hubungkan Mikrofon</div>
                <Button size="sm" onClick={startMicMonitoring} className="mt-3"><MicIcon />Aktifkan Mikrofon</Button>
              </div>
            )}

            {isRecording && (
              <Badge variant="destructive" className="absolute right-3 top-3 animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />Merekam: {countdown}s
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleRecord} disabled={isRecording || analyzing} variant={isRecording ? 'destructive' : 'default'} className="flex-1">
              {isRecording ? <><StopIcon />Batuk sekarang ({countdown}s)</>
                : analyzing ? <><UpdateIcon className="animate-spin" />Menganalisis…</>
                : <><MicIcon />Rekam (3 dtk)</>}
            </Button>
            {audioUrl && (
              <Button variant="outline" onClick={togglePlay} disabled={isRecording || analyzing}>
                {isPlaying ? <PauseIcon /> : <PlayIcon />}{isPlaying ? 'Jeda' : 'Putar'}
              </Button>
            )}
            {result && (
              <Button variant="secondary" size="icon" title="Ulangi" aria-label="Ulangi pengujian"
                onClick={() => { setResult(null); setAtt(null); setRaw(null); setAudioUrl(null); setAudioBlob(null); setDecodedBuffer(null); }}>
                <ReloadIcon />
              </Button>
            )}
          </div>

          {/* kamera laptop untuk pelacakan individu */}
          <div className="rounded-md border border-slate-200/60 p-4 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              <VideoIcon className="h-4 w-4 text-primary dark:text-blue-300" />
              <span className="mr-auto font-medium" title="Opsional. Video diproses di browser, tidak diunggah.">Kamera</span>
              {camState === 'off' || camState === 'error'
                ? <Button size="sm" variant="outline" onClick={camStart} disabled={isRecording || analyzing}><VideoIcon />Aktifkan</Button>
                : <Button size="sm" variant="ghost" onClick={camStop} disabled={isRecording}>Matikan</Button>}
            </div>
            <div className={cn('relative mt-3 overflow-hidden rounded-md bg-slate-900', camState === 'off' || camState === 'error' ? 'hidden' : '')}>
              <video ref={camVideoRef} muted playsInline className="block aspect-video w-full -scale-x-100 object-cover" />
              {(camState === 'starting' || camState === 'loading-model') && (
                <div className="absolute inset-0 grid place-items-center bg-slate-900/70 text-xs text-white">
                  <span className="flex items-center gap-2"><UpdateIcon className="animate-spin" />{camState === 'starting' ? 'Menyalakan kamera…' : 'Memuat model…'}</span>
                </div>
              )}
              {isRecording && camState === 'ready' && <Badge variant="destructive" className="absolute left-3 top-3"><span className="h-1.5 w-1.5 rounded-full bg-white" />Melacak wajah</Badge>}
            </div>
            <p className={cn('mt-2 text-xs', camError ? 'text-danger' : 'text-muted-foreground')}>
              {camError || 'Kamera menyala otomatis. Video diproses di browser dan tidak diunggah; hanya satu frame saat batuk yang ditampilkan.'}
            </p>
          </div>

          {audioUrl && <audio ref={audioPlayerRef} src={audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />}

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-white/5">30–50 cm</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-white/5">Batuk 1–2×</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-white/5">16 kHz · CWT</span>
          </div>
        </div>

        {/* hasil & triase */}
        <div className="col-span-12 lg:col-span-6">
          {analyzing ? (
            <div role="status" aria-label="Menganalisis" className="space-y-4">
              <Skeleton className="h-[76px] w-full" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[74px]" />)}</div>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-8 w-32" />
            </div>
          ) : result && f ? (
            <div className="space-y-4">
              <div className={cn('flex items-center gap-3 rounded-md p-4', result.is_tb ? 'bg-danger/10' : 'bg-success/15')}>
                {result.is_tb
                  ? <ExclamationTriangleIcon className="h-6 w-6 shrink-0 text-danger" />
                  : <CheckCircledIcon className="h-6 w-6 shrink-0 text-success" />}
                <div className="mr-auto">
                  <div className="text-xs text-muted-foreground">Hasil</div>
                  <div className={cn('text-base font-medium', result.is_tb ? 'text-danger' : 'text-[#5b7f0a] dark:text-success')}>
                    {result.is_tb ? 'Terindikasi TB' : 'Negatif TB'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-2xl font-medium">{(result.confidence * 100).toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">Confidence</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {metrics.map((m) => (
                  <div key={m.k} className="rounded-md border border-slate-200/60 p-3 dark:border-white/10">
                    <div className="text-xs text-muted-foreground">{m.k}</div>
                    <div className={cn('num mt-1 font-medium', m.ok === null ? '' : m.ok ? 'text-success' : 'text-pending')}>{m.v}</div>
                    <div className="text-xs text-muted-foreground">{m.ok === false ? m.badText : m.okText}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-md border border-slate-200/60 p-4 dark:border-white/10">
                <div className="flex items-center gap-2 font-medium" title={result.triage.clinical_reasoning}><ActivityLogIcon className="h-4 w-4 text-primary dark:text-blue-300" />Rekomendasi</div>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {result.triage.who_recommended_actions.slice(0, 2).map((act, i) => <li key={i}>{act}</li>)}
                </ul>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleSaveToDashboard} disabled={saving}><BookmarkIcon />{saving ? 'Menyimpan…' : 'Simpan'}</Button>
                <span className="ml-auto text-xs text-muted-foreground">MobileNetV3</span>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[290px] flex-col justify-center rounded-md border border-dashed border-slate-200 p-6 dark:border-white/10">
              <div className="text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary dark:text-blue-300">
                  <ActivityLogIcon className="h-5 w-5" />
                </div>
                <div className="font-medium">Siap merekam</div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-200/60 pt-5 dark:border-white/10">
                {[
                  { n: '01', t: 'Capture', v: '3s Audio', s: '16 kHz', c: 'text-primary dark:text-blue-300' },
                  { n: '02', t: 'Transform', v: 'CWT', s: '224×224', c: 'text-success' },
                  { n: '03', t: 'Triage', v: 'Triase', s: 'Skor', c: 'text-pending' },
                ].map((x) => (
                  <div key={x.n} className="rounded-md border border-slate-200/60 p-3 dark:border-white/10">
                    <div className={cn('text-xs font-medium', x.c)}>{x.n} · {x.t}</div>
                    <div className="mt-1 font-medium">{x.v}</div>
                    <div className="text-xs text-muted-foreground">{x.s}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {result && att && shownAtt && (
        <div className="mt-6 grid grid-cols-12 gap-6 border-t border-slate-200/60 pt-5 dark:border-white/10">
          <div className="col-span-12 lg:col-span-7">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="mr-auto font-medium">Sumber Batuk</span>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={blurFaces} onCheckedChange={setBlurFaces} aria-label="Samarkan wajah" />Samarkan wajah
              </label>
            </div>
            <CoughSourceFrame att={shownAtt ?? att} tb={result.is_tb} blurFaces={blurFaces} doa={stereo?.ok ? { az: stereo.azimuth, sigma: doaSigma } : undefined} />
          </div>
          <div className="col-span-12 space-y-4 lg:col-span-5">
            {shownAtt.source === null ? (
              <div className="rounded-md bg-pending/10 p-4">
                <div className="font-medium text-pending" title="Pastikan wajah terlihat di kamera saat batuk.">Tidak ada orang</div>
              </div>
            ) : shownAtt.ambiguous ? (
              <div className="rounded-md bg-pending/10 p-4">
                <div className="font-medium text-[#b45c00] dark:text-pending" title="Kandidat teratas tidak cukup berbeda. Perlu konfirmasi petugas.">Ambigu · {shownAtt.people.length} orang</div>
              </div>
            ) : (
              <div className={cn('rounded-md p-4', result.is_tb ? 'bg-danger/10' : 'bg-success/15')}
                title={(shownAtt.people.length === 1 ? 'Hanya satu orang di kamera.' : `Dipilih dari ${shownAtt.people.length} orang di kamera.`) + ' ' + shownAtt.people[0].reason}>
                <div className={cn('font-medium', result.is_tb ? 'text-danger' : 'text-[#5b7f0a] dark:text-success')}>
                  Teridentifikasi · {(shownAtt.people[0].share * 100).toFixed(0)}%
                </div>
              </div>
            )}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Onset</span><span className="num font-medium">{shownAtt.onsetSec.toFixed(2)} s</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Orang</span><span className="num font-medium">{shownAtt.people.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">DoA</span><span className="font-medium">{stereo?.ok ? `${stereo.azimuth > 0 ? '+' : ''}${stereo.azimuth.toFixed(0)}°` : '–'}</span></div>
            </div>
          </div>
        </div>
      )}

      {result && decodedBuffer && (
        <div className="mt-6 border-t border-slate-200/60 pt-5 dark:border-white/10">
          <DoaPanel stereo={stereo} mono={decodedBuffer} micCm={micCm} onMicCm={setMicCm} swap={swapCh} onSwap={setSwapCh} />
        </div>
      )}

      {result && decodedBuffer && (
        <div className="mt-6 border-t border-slate-200/60 pt-5 dark:border-white/10">
          <LiveCoughSpectrogram
            audioBuffer={decodedBuffer}
            isTb={result.is_tb}
            confidence={result.confidence}
            tbBandRatio={result.acoustic_features.tb_band_energy_ratio}
            spectralCentroid={result.acoustic_features.spectral_centroid_hz}
          />
        </div>
      )}
    </div>
  );
}
