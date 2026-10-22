'use client';

import * as React from 'react';
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

    const fftSize = 1024;
    const hopSize = 256;
    const numFrames = Math.floor((totalSamples - fftSize) / hopSize);
    if (numFrames <= 0) return;

    // Hann window table
    const hann = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    }

    // Radix-2 FFT lookup tables
    const cosT = new Float32Array(fftSize / 2);
    const sinT = new Float32Array(fftSize / 2);
    for (let i = 0; i < fftSize / 2; i++) {
      cosT[i] = Math.cos((2 * Math.PI * i) / fftSize);
      sinT[i] = Math.sin((2 * Math.PI * i) / fftSize);
    }
    const rev = new Uint32Array(fftSize);
    const bits = Math.log2(fftSize);
    for (let i = 0; i < fftSize; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      rev[i] = r;
    }

    const numFreqBins = fftSize / 2;
    const spectrogramData: Float32Array[] = [];
    let maxVal = -1e9;
    const re = new Float32Array(fftSize);
    const im = new Float32Array(fftSize);

    for (let f = 0; f < numFrames; f++) {
      const offset = f * hopSize;
      for (let i = 0; i < fftSize; i++) {
        re[rev[i]] = channelData[offset + i] * hann[i];
        im[rev[i]] = 0;
      }
      for (let size = 2; size <= fftSize; size <<= 1) {
        const half = size >> 1;
        const step = fftSize / size;
        for (let i = 0; i < fftSize; i += size) {
          for (let j = 0, k = 0; j < half; j++, k += step) {
            const tr = re[i + j + half] * cosT[k] + im[i + j + half] * sinT[k];
            const ti = im[i + j + half] * cosT[k] - re[i + j + half] * sinT[k];
            re[i + j + half] = re[i + j] - tr;
            im[i + j + half] = im[i + j] - ti;
            re[i + j] += tr;
            im[i + j] += ti;
          }
        }
      }
      const db = new Float32Array(numFreqBins);
      for (let k = 0; k < numFreqBins; k++) {
        const v = 20 * Math.log10(Math.sqrt(re[k] * re[k] + im[k] * im[k]) + 1e-9);
        db[k] = v;
        if (v > maxVal) maxVal = v;
      }
      spectrogramData.push(db);
    }

    // Dynamic range window (dB below peak) so quiet noise stays dark like a studio spectrogram
    const dynamicRange = 90;
    const minVal = maxVal - dynamicRange;
    const range = dynamicRange;
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#02030f';
    ctx.fillRect(0, 0, w, h);

    // Roseus-style colormap: deep navy -> violet -> magenta -> orange -> pale yellow
    const stops: [number, number, number][] = [
      [2, 3, 20],
      [25, 20, 90],
      [80, 25, 140],
      [140, 35, 150],
      [200, 55, 130],
      [240, 100, 80],
      [252, 170, 80],
      [255, 240, 190],
    ];
    const getColor = (norm: number): [number, number, number] => {
      norm = Math.max(0, Math.min(1, norm));
      const pos = norm * (stops.length - 1);
      const i = Math.min(stops.length - 2, Math.floor(pos));
      const t = pos - i;
      const c0 = stops[i];
      const c1 = stops[i + 1];
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * t),
        Math.round(c0[1] + (c1[1] - c0[1]) * t),
        Math.round(c0[2] + (c1[2] - c0[2]) * t),
      ];
    };

    const imgData = ctx.createImageData(w, h);
    const pixels = imgData.data;

    for (let x = 0; x < w; x++) {
      const frame = spectrogramData[Math.min(numFrames - 1, Math.floor((x / w) * numFrames))];
      for (let y = 0; y < h; y++) {
        // High frequencies on top, low frequencies on bottom (linear, with interpolation)
        const pos = ((h - 1 - y) / (h - 1)) * (numFreqBins - 1);
        const lo = Math.floor(pos);
        const frac = pos - lo;
        const val = frame[lo] * (1 - frac) + frame[Math.min(numFreqBins - 1, lo + 1)] * frac;
        const [r, g, b] = getColor((val - minVal) / range);

        const pIdx = (y * w + x) * 4;
        pixels[pIdx] = r;
        pixels[pIdx + 1] = g;
        pixels[pIdx + 2] = b;
        pixels[pIdx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const nyquist = sampleRate / 2;
    const yTop = h - (3500 / nyquist) * h;
    const yBottom = h - (1200 / nyquist) * h;

    // Overlay: TB Resonant Frequency Band (1.2 kHz - 3.5 kHz)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(0.5, yTop, w - 1, yBottom - yTop);
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(2, 3, 15, 0.8)';
    ctx.fillRect(w - 216, yTop + 5, 210, 18);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '500 10px Poppins, sans-serif';
    ctx.fillText('Pita Resonansi TB (1.200 - 3.500 Hz)', w - 210, yTop + 18);

    // Frequency axis labels on the left (kHz), as in audio-analysis tools
    const tickStep = nyquist / 1000 > 6 ? 2 : 1;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '10px Poppins, sans-serif';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    for (let khz = 0; khz <= nyquist / 1000 + 1e-6; khz += tickStep) {
      const y = Math.min(h - 3, Math.max(10, h - (khz * 1000 / nyquist) * h));
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(5, y);
      ctx.stroke();
      ctx.fillText(`${khz}kHz`, 8, y + 3);
    }
  }, [audioBuffer, viewMode]);

  if (!audioBuffer) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <div className="flex items-center gap-2 font-medium">
            Spektrogram Batuk
            <Badge variant="soft-primary">16 kHz</Badge>
          </div>
        </div>
        <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'full' | 'cwt_224')} className="rounded-md bg-slate-100 p-1 dark:bg-white/5">
          <ToggleGroupItem value="full" size="sm">Penuh</ToggleGroupItem>
          <ToggleGroupItem value="cwt_224" size="sm">224×224</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="overflow-hidden rounded-md bg-slate-900">
        <canvas
          ref={canvasRef}
          width={viewMode === 'full' ? 900 : 224}
          height={viewMode === 'full' ? 320 : 224}
          className={cn('block w-full', viewMode === 'cwt_224' && 'mx-auto aspect-square max-w-[260px]')}
        />
        <div className="num flex justify-between border-t border-white/10 px-2 py-1 text-[10px] text-slate-400">
          <span>0.0s</span>
          <span>1.5s</span>
          <span>3.0s</span>
        </div>
      </div>
    </div>
  );
}
