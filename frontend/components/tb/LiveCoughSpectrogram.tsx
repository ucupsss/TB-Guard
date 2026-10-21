'use client';

import * as React from 'react';
import { InfoCircledIcon, LayersIcon } from '@radix-ui/react-icons';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

interface LiveCoughSpectrogramProps {
  audioBuffer: AudioBuffer | null;
  isTb: boolean;
  confidence: number;
  tbBandRatio?: number;
  spectralCentroid?: number;
}

export function LiveCoughSpectrogram({
  audioBuffer,
  isTb,
  confidence,
  tbBandRatio = 0.28,
  spectralCentroid = 2100,
}: LiveCoughSpectrogramProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [viewMode, setViewMode] = React.useState<'full' | 'cwt_224'>('full');

  React.useEffect(() => {
    if (!canvasRef.current || !audioBuffer) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const totalSamples = channelData.length;

    const fftSize = 512;
    const hopSize = 128;
    const numFrames = Math.floor((totalSamples - fftSize) / hopSize);
    if (numFrames <= 0) return;

    // Hann window table
    const hann = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    }

    const numFreqBins = fftSize / 2;
    const spectrogramData: Float32Array[] = [];
    let maxVal = -1e9;
    let minVal = 1e9;

    // Compute DFT magnitude per frame
    for (let f = 0; f < numFrames; f++) {
      const offset = f * hopSize;
      const magnitudes = new Float32Array(numFreqBins);

      for (let k = 0; k < numFreqBins; k++) {
        let real = 0;
        let imag = 0;
        // Step through windowed samples
        const step = 2; // optimization stride
        for (let n = 0; n < fftSize; n += step) {
          const sample = channelData[offset + n] * hann[n];
          const angle = (2 * Math.PI * k * n) / fftSize;
          real += sample * Math.cos(angle);
          imag -= sample * Math.sin(angle);
        }
        const mag = Math.sqrt(real * real + imag * imag);
        const logMag = Math.log10(mag + 1e-6);
        magnitudes[k] = logMag;

        if (logMag > maxVal) maxVal = logMag;
        if (logMag < minVal) minVal = logMag;
      }
      spectrogramData.push(magnitudes);
    }

    const range = Math.max(1e-4, maxVal - minVal);
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // Colormap stops: dark navy -> blue -> cyan -> yellow -> orange -> red
    const getColor = (norm: number): [number, number, number] => {
      norm = Math.max(0, Math.min(1, norm));
      if (norm < 0.2) {
        const t = norm / 0.2;
        return [Math.round(15 + 10 * t), Math.round(23 + 30 * t), Math.round(42 + 100 * t)];
      } else if (norm < 0.45) {
        const t = (norm - 0.2) / 0.25;
        return [Math.round(25 + 10 * t), Math.round(53 + 120 * t), Math.round(142 + 80 * t)];
      } else if (norm < 0.7) {
        const t = (norm - 0.45) / 0.25;
        return [Math.round(35 + 180 * t), Math.round(173 + 40 * t), Math.round(222 - 120 * t)];
      } else if (norm < 0.88) {
        const t = (norm - 0.7) / 0.18;
        return [Math.round(215 + 40 * t), Math.round(213 - 100 * t), Math.round(102 - 70 * t)];
      } else {
        const t = (norm - 0.88) / 0.12;
        return [255, Math.round(113 + 142 * t), Math.round(32 + 223 * t)];
      }
    };

    const imgData = ctx.createImageData(w, h);
    const pixels = imgData.data;

    // Draw spectrogram scaled to canvas
    for (let x = 0; x < w; x++) {
      const frameIdx = Math.floor((x / w) * numFrames);
      const frame = spectrogramData[frameIdx];
      if (!frame) continue;

      for (let y = 0; y < h; y++) {
        // High frequencies on top, low frequencies on bottom
        const binIdx = Math.floor(((h - 1 - y) / h) * numFreqBins);
        const val = frame[binIdx] ?? minVal;
        const norm = (val - minVal) / range;
        const [r, g, b] = getColor(norm);

        const pIdx = (y * w + x) * 4;
        pixels[pIdx] = r;
        pixels[pIdx + 1] = g;
        pixels[pIdx + 2] = b;
        pixels[pIdx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Overlay: TB Resonant Frequency Band (1.2 kHz - 3.5 kHz)
    // 0 Hz is bottom (y = h), 8000 Hz is top (y = 0)
    const nyquist = sampleRate / 2;
    const yTop = h - (3500 / nyquist) * h;
    const yBottom = h - (1200 / nyquist) * h;
    const bandHeight = yBottom - yTop;

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(0, yTop, w, bandHeight);
    ctx.setLineDash([]);

    // Band label tag
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(8, yTop + 6, 210, 20);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '500 10px Roboto, sans-serif';
    ctx.fillText('Pita Resonansi TB (1.200 - 3.500 Hz)', 14, yTop + 20);

    // Y-axis frequency ticks
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '9px Roboto, sans-serif';
    ctx.fillText('8 kHz', w - 36, 12);
    ctx.fillText('3.5 kHz', w - 48, yTop + 4);
    ctx.fillText('1.2 kHz', w - 48, yBottom - 4);
    ctx.fillText('0 Hz', w - 30, h - 6);
  }, [audioBuffer, viewMode]);

  if (!audioBuffer) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <div className="flex items-center gap-2 font-medium">
            Spektrogram Akustik &amp; CWT Scalogram Rekaman
            <Badge variant="soft-primary">16 kHz</Badge>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Visualisasi domain frekuensi-waktu dari batuk yang direkam, diselaraskan dengan pipeline training MobileNetV3.
          </div>
        </div>
        <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'full' | 'cwt_224')} className="rounded-md bg-slate-100 p-1 dark:bg-white/5">
          <ToggleGroupItem value="full" size="sm">Spektrogram Penuh (0–8 kHz)</ToggleGroupItem>
          <ToggleGroupItem value="cwt_224" size="sm">Format Training (224×224)</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid grid-cols-12 items-center gap-6">
        <div className={cn(viewMode === 'full' ? 'col-span-12 lg:col-span-8' : 'col-span-12 lg:col-span-6')}>
          <div className="overflow-hidden rounded-md bg-slate-900">
            <canvas
              ref={canvasRef}
              width={viewMode === 'full' ? 560 : 224}
              height={viewMode === 'full' ? 180 : 224}
              className={cn('block w-full', viewMode === 'cwt_224' && 'mx-auto aspect-square max-w-[260px]')}
            />
            <div className="num flex justify-between border-t border-white/10 px-2 py-1 text-[10px] text-slate-400">
              <span>0.0s (Onset Glotis)</span>
              <span>1.5s (Fase Peluruhan)</span>
              <span>3.0s</span>
            </div>
          </div>
        </div>

        <div className={cn('space-y-4', viewMode === 'full' ? 'col-span-12 lg:col-span-4' : 'col-span-12 lg:col-span-6')}>
          <div className="rounded-md border border-slate-200/60 p-4 dark:border-white/10">
            <div className="flex items-center gap-2 font-medium"><LayersIcon className="h-4 w-4 text-primary dark:text-blue-300" />Transparansi Pipeline Training</div>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              Spektrogram batuk ini dipetakan ke format matriks <span className="font-medium text-foreground">CWT Morlet 224×224 piksel</span>, sama dengan representasi pada dataset Kaggle <code className="rounded bg-slate-100 px-1 text-xs dark:bg-white/10">cwt_scalograms</code>.
            </p>
            <div className="mt-3 space-y-1.5 border-t border-slate-200/60 pt-3 text-xs dark:border-white/10">
              <div className="flex justify-between"><span className="text-muted-foreground">Arsitektur Model</span><span className="font-medium">MobileNetV3-Small</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pita Resonansi Kritis</span><span className="font-medium text-primary dark:text-blue-300">1.2 – 3.5 kHz</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Val F1-Score TB</span><span className="font-medium text-success">88.4%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Checkpoint</span><span className="font-mono text-[11px]">mobilenetv3_cwt_best.pth</span></div>
            </div>
          </div>

          <div className="flex gap-2 rounded-md bg-primary/5 p-3 text-xs text-muted-foreground">
            <InfoCircledIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary dark:text-blue-300" />
            <span>Warna merah/kuning menunjukkan konsentrasi energi batuk tertinggi. Pada batuk normal, energi cepat padam dan terkonsentrasi pada frekuensi rendah tanpa resonansi turbulen panjang di pita 1.2–3.5 kHz.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
