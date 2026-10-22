'use client';

import * as React from 'react';
import { ArrowRightIcon, ActivityLogIcon, BarChartIcon, ChatBubbleIcon, CheckCircledIcon, MixerHorizontalIcon, TargetIcon, VideoIcon } from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';

const SPECIALISTS = [
  { icon: VideoIcon, label: 'Sensor & Ruang Publik', hint: 'cek mic array dan kamera' },
  { icon: ActivityLogIcon, label: 'Dokter AI / Triase', hint: 'skor risiko batuk' },
  { icon: TargetIcon, label: 'Pendamping Pasien', hint: 'kepatuhan minum obat' },
  { icon: BarChartIcon, label: 'Analisis Kebijakan', hint: 'estimasi penghematan biaya' },
];

/** Alur kerja versi umum dalam 4 langkah; langkah yang sedang berjalan menyala bila chat terhubung live. */
export function OrchestraWorkflowBar({ activeStep }: { activeStep?: 1 | 2 | 3 | 4 }) {
  const steps = [
    { n: 1, icon: ChatBubbleIcon, title: 'Perintah masuk', text: 'Cukup bertanya lewat teks atau suara santai, tanpa perlu hafal menu aplikasi.' },
    { n: 2, icon: MixerHorizontalIcon, title: 'Koordinator membagi tugas', text: 'Master Orchestrator memahami maksud Anda lalu mendisposisikan ke asisten spesialis yang tepat.' },
    { n: 3, icon: TargetIcon, title: '4 spesialis bekerja serempak', text: '', extra: true },
    { n: 4, icon: CheckCircledIcon, title: 'Aksi dan jawaban siap pakai', text: 'Kamera bergerak, data tersaring di layar, dan laporan ringkas langsung tersaji.' },
  ] as const;

  return (
    <div className="box p-4 sm:p-5" aria-label="Alur kerja Orchestra AI">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">Cara kerja Orchestra AI</h2>
        <span className="text-xs text-muted-foreground">4 langkah, dari pertanyaan sampai jawaban</span>
      </div>
      <ol className="grid gap-3 lg:grid-cols-4 lg:gap-0">
        {steps.map((s, i) => {
          const Icon = s.icon, on = activeStep === s.n, past = !!activeStep && activeStep > s.n;
          return (
            <li key={s.n} className="relative flex items-stretch lg:pr-6">
              <div className={cn('flex w-full flex-col rounded-xl border p-3.5 transition-colors', on ? 'border-primary bg-primary/5 ring-2 ring-primary/15' : past ? 'border-primary/30' : '')}>
                <div className="flex items-center gap-2.5">
                  <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', on || past ? 'bg-primary text-white' : 'bg-primary/10 text-primary')}><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <div className="text-[10px] font-medium tracking-wider text-muted-foreground">LANGKAH {s.n}</div>
                    <div className="text-sm font-medium leading-snug text-foreground">{s.title}</div>
                  </div>
                </div>
                {'extra' in s ? (
                  <ul className="mt-2.5 grid gap-1.5">
                    {SPECIALISTS.map(({ icon: SIcon, label, hint }) => (
                      <li key={label} className="flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
                        <SIcon className="mt-0.5 h-3 w-3 shrink-0 text-primary" /><span><b className="font-medium text-foreground">{label}</b> ({hint})</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{s.text}</p>}
              </div>
              {i < steps.length - 1 && <ArrowRightIcon className="absolute right-0 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground lg:block" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
