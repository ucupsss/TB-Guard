'use client';

import * as React from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Layers,
  Save,
  Volume2,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  classifyLiveAudioBlob,
  type LiveClassificationResult,
} from '@/lib/ai-service';
import { LiveCoughSpectrogram } from '@/components/tb/LiveCoughSpectrogram';
import { useStore } from '@/lib/store';
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
  const { addDetection } = useStore() as { addDetection?: (d: any) => void };
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
        },
      });

      mediaStreamRef.current = stream;
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

  const handleSaveToDashboard = () => {
    if (!result) return;
    toast.success(`Deteksi ${result.uuid} disimpan ke antrean pemantauan!`);
  };

  return (
    <div className="box p-5 border border-primary/20 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 pb-4 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Perekam Akustik Batuk (Edge Input)
              <Badge variant="soft-primary" className="text-[11px] gap-1 font-medium">
                <Sparkles className="h-3 w-3 text-primary" /> Live AI Engine
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              Sampling 16.000 Hz · Deteksi otomatis komponen glotis batuk TB vs Non-TB
            </p>
          </div>
        </div>

        {/* Volume Level indicator */}
        <div className="flex items-center gap-2.5 rounded-full border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 text-xs dark:border-white/10 dark:bg-slate-800/50">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground text-[11px]">Level Mic:</span>
          <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden dark:bg-slate-700">
            <div
              className={cn(
                'h-full transition-all duration-75',
                volumeLevel > 70 ? 'bg-red-500' : volumeLevel > 25 ? 'bg-emerald-500' : 'bg-primary'
              )}
              style={{ width: `${volumeLevel}%` }}
            />
          </div>
          <span className="text-[11px] font-mono font-medium text-slate-600 dark:text-slate-300 w-7 text-right">
            {volumeLevel}%
          </span>
        </div>
      </div>

      {/* Mic permission prompt or Canvas visualizer */}
      <div className="mt-5 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-6 space-y-4">
          <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
            <canvas ref={canvasRef} width={500} height={160} className="w-full h-40 block" />

            {!hasMicPermission && (
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                <Mic className="h-10 w-10 text-primary mb-2 animate-bounce" />
                <h4 className="font-medium text-sm text-white">Hubungkan Mikrofon</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Izinkan browser mengakses mikrofon laptop Anda untuk merekam suara batuk dan menampilkan visualisasi spektrum audio real-time.
                </p>
                <Button size="sm" onClick={startMicMonitoring} className="mt-3">
                  Aktifkan Mikrofon
                </Button>
              </div>
            )}

            {isRecording && (
              <div className="absolute top-3 right-3 flex items-center gap-2 bg-red-600/90 text-white text-xs px-2.5 py-1 rounded-full font-medium animate-pulse">
                <span className="h-2 w-2 rounded-full bg-white" />
                Merekam: {countdown}s
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleRecord}
              disabled={isRecording || analyzing}
              className={cn(
                'flex-1 gap-2 h-11 text-sm font-medium shadow-md transition-all',
                isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90'
              )}
            >
              {isRecording ? (
                <>
                  <Square className="h-4 w-4 fill-white" />
                  Merekam ({countdown}s)... Silakan Batuk
                </>
              ) : analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menganalisis Akustik dengan AI...
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  Mulai Rekam Batuk (3 Detik)
                </>
              )}
            </Button>

            {audioUrl && (
              <Button
                variant="outline"
                onClick={togglePlay}
                disabled={isRecording || analyzing}
                className="gap-2 h-11"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isPlaying ? 'Jeda' : 'Putar Hasil'}
              </Button>
            )}

            {result && (
              <Button
                variant="secondary"
                onClick={() => {
                  setResult(null);
                  setAudioUrl(null);
                  setAudioBlob(null);
                  setDecodedBuffer(null);
                }}
                className="h-11"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>

          {audioUrl && (
            <audio
              ref={audioPlayerRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
          )}

          {/* User Instructions */}
          <div className="rounded-lg bg-slate-50 p-3.5 text-xs text-slate-600 border border-slate-200 dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-300 space-y-1.5">
            <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              💡 Petunjuk Pengujian Batuk:
            </div>
            <ul className="list-disc pl-4 space-y-1">
              <li>Posisikan laptop/mikrofon sekitar <strong>30 – 50 cm</strong> dari mulut.</li>
              <li>Klik tombol <strong>Mulai Rekam</strong>, lalu batuklah sebanyak <strong>1 – 2 kali</strong> secara wajar ke arah mikrofon.</li>
              <li>Sistem akan menyaring frekuensi 16 kHz dan mengekstrak spektrum CWT Morlet secara otomatis.</li>
            </ul>
          </div>
        </div>

        {/* Real-time Results & AI Triage Panel */}
        <div className="col-span-12 lg:col-span-6">
          {analyzing ? (
            <div className="h-full min-h-[260px] rounded-xl border border-dashed border-primary/40 bg-primary/5 flex flex-col items-center justify-center p-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                Mengekstrak Fitur Akustik CWT & Spektrum Resonansi
              </h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Model MobileNetV3 sedang menghitung densitas energi pada pita frekuensi 1.2 – 3.5 kHz dan mencocokkan pola glotis batuk...
              </p>
            </div>
          ) : result ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
              {/* Classification Header */}
              <div
                className={cn(
                  'rounded-lg p-4 flex items-center justify-between gap-3',
                  result.is_tb
                    ? 'bg-red-50 border border-red-200 text-red-950 dark:bg-red-950/30 dark:border-red-900 dark:text-red-100'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-950 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-100'
                )}
              >
                <div className="flex items-center gap-3">
                  {result.is_tb ? (
                    <AlertTriangle className="h-7 w-7 text-red-600 flex-shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-7 w-7 text-emerald-600 flex-shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider opacity-80">
                      Hasil Prediksi AI Model
                    </div>
                    <div className="text-lg font-bold">
                      {result.is_tb ? 'Terindikasi Pola Batuk TB' : 'Bukan Batuk TB (Normal / Negatif)'}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-black num">
                    {(result.confidence * 100).toFixed(1)}%
                  </div>
                  <div className="text-[11px] opacity-75">Confidence Score</div>
                </div>
              </div>

              {/* Acoustic Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="text-muted-foreground">Harmonisitas Glotis</div>
                  <div className={cn('mt-1 font-bold num', (result.acoustic_features.harmonicity ?? 0.4) > 0.3 ? 'text-emerald-600' : 'text-amber-600')}>
                    {result.acoustic_features.harmonicity ? `${(result.acoustic_features.harmonicity * 100).toFixed(0)}%` : 'Tonal'}
                    <span className="text-[10px] font-normal block text-muted-foreground">
                      {(result.acoustic_features.harmonicity ?? 0.4) > 0.3 ? 'Jernih (Batuk Biasa)' : 'Parau/Turbulen'}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="text-muted-foreground">Laju Peluruhan Suara</div>
                  <div className={cn('mt-1 font-bold num', (result.acoustic_features.decay_ratio ?? 0.2) < 0.25 ? 'text-emerald-600' : 'text-amber-600')}>
                    {result.acoustic_features.decay_ratio ? `${(result.acoustic_features.decay_ratio * 100).toFixed(0)}%` : 'Cepat'}
                    <span className="text-[10px] font-normal block text-muted-foreground">
                      {(result.acoustic_features.decay_ratio ?? 0.2) < 0.25 ? 'Cepat (Normal)' : 'Memanjang (TB)'}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="text-muted-foreground">Turbulensi Spektral</div>
                  <div className={cn('mt-1 font-bold num', (result.acoustic_features.spectral_flatness ?? 0.3) < 0.35 ? 'text-emerald-600' : 'text-amber-600')}>
                    {result.acoustic_features.spectral_flatness ? `${(result.acoustic_features.spectral_flatness * 100).toFixed(0)}%` : 'Rendah'}
                    <span className="text-[10px] font-normal block text-muted-foreground">
                      {(result.acoustic_features.spectral_flatness ?? 0.3) < 0.35 ? 'Stabil' : 'Kaotik'}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="text-muted-foreground">Spectral Centroid</div>
                  <div className="mt-1 font-bold num text-slate-800 dark:text-slate-100">
                    {result.acoustic_features.spectral_centroid_hz} Hz
                    <span className="text-[10px] font-normal block text-muted-foreground">
                      Pita 1.2 – 3.5 kHz
                    </span>
                  </div>
                </div>
              </div>

              {/* LLM Clinical Reasoning */}
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/30">
                <div className="font-semibold text-xs text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-primary" /> Analisis Klinis LLM & Rekomendasi:
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {result.triage.clinical_reasoning}
                </p>
                <div className="mt-2.5 space-y-1">
                  {result.triage.who_recommended_actions.slice(0, 2).map((act, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-slate-700 dark:text-slate-200">
                      <span className="text-primary font-bold">•</span>
                      <span>{act}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-1">
                <Button size="sm" variant="outline" onClick={handleSaveToDashboard} className="gap-1.5 text-xs">
                  <Save className="h-3.5 w-3.5" />
                  Simpan Deteksi ({result.uuid})
                </Button>
                <span className="text-[10px] text-muted-foreground">
                  Model: MobileNetV3 (Colab CWT Scalograms)
                </span>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[290px] rounded-xl border border-dashed border-slate-200 bg-gradient-to-b from-slate-50/70 to-slate-100/30 p-6 flex flex-col justify-center dark:border-slate-800 dark:from-slate-900/40 dark:to-slate-900/10">
              <div className="text-center mb-5">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-white/10 dark:text-blue-300">
                  <Activity className="h-6 w-6" />
                </div>
                <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                  Menunggu Sinyal Rekaman Audio
                </h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Tekan tombol "Mulai Rekam Batuk" di sebelah kiri untuk memproses gelombang audio mikrofon Anda secara real-time.
                </p>
              </div>

              {/* 3 Step Interactive Workflow Preview */}
              <div className="grid grid-cols-3 gap-2.5 pt-4 border-t border-slate-200/60 dark:border-white/10 text-left">
                <div className="rounded-lg bg-white/80 p-2.5 border border-slate-200/60 shadow-sm dark:bg-slate-800/40 dark:border-white/5">
                  <span className="text-[10px] font-bold text-primary dark:text-blue-400">01. CAPTURE</span>
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-0.5">3s Audio Mono</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Resampling 16 kHz</div>
                </div>
                <div className="rounded-lg bg-white/80 p-2.5 border border-slate-200/60 shadow-sm dark:bg-slate-800/40 dark:border-white/5">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">02. TRANSFORM</span>
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-0.5">CWT Morlet</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Matriks 224×224</div>
                </div>
                <div className="rounded-lg bg-white/80 p-2.5 border border-slate-200/60 shadow-sm dark:bg-slate-800/40 dark:border-white/5">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">03. TRIAGE</span>
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-0.5">Prediksi & LLM</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Skor & Rekomendasi</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Real-time Spectrogram & CWT Scalogram Training Pipeline Alignment */}
      {result && decodedBuffer && (
        <div className="mt-6">
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
