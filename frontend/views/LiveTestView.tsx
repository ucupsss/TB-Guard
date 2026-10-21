'use client';

import * as React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { LiveMicRecorder } from '@/components/tb/LiveMicRecorder';
import { Badge } from '@/components/ui/badge';
import { Activity, BrainCircuit, Cpu, Radio, ShieldCheck } from 'lucide-react';

export default function LiveTestView() {
  return (
    <AppLayout crumbs={[{ label: 'Uji Suara Mikrofon' }]}>
      {/* Header Section */}
      <div className="intro-y mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100 sm:text-2xl">
              Uji Suara Mikrofon & Deteksi TB
            </h1>
            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 gap-1.5 text-xs py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Edge Input
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Pengujian akustik batuk mandiri secara langsung melalui mikrofon laptop atau USB external mic dengan validasi CWT Morlet.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
            <Cpu className="h-3.5 w-3.5 text-primary" />
            <span>MobileNetV3 + CWT</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
            <Radio className="h-3.5 w-3.5 text-emerald-600" />
            <span>16 kHz Resampled</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Mic Recorder Component */}
      <div className="mt-6">
        <LiveMicRecorder />
      </div>

      {/* Architecture & Clinical Governance Notes */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/50">
          <div className="flex items-center gap-2 font-semibold text-xs text-slate-800 dark:text-slate-100">
            <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
              <BrainCircuit className="h-4 w-4" />
            </div>
            <span>Representasi CWT Scalogram</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Sinyal audio mikrofon dikonversi menjadi time-frequency matrix Morlet CWT 224×224 yang merepresentasikan konsentrasi energi batuk pada spektrum 1.2 – 3.5 kHz.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/50">
          <div className="flex items-center gap-2 font-semibold text-xs text-slate-800 dark:text-slate-100">
            <div className="rounded-lg bg-emerald-500/10 p-1.5 text-emerald-600">
              <Cpu className="h-4 w-4" />
            </div>
            <span>Anti-Aliased 16 kHz Mono</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Pipeline audio menormalisasi rekaman mikrofon agar identik dengan standar dataset Kaggle RespiScan dan HeAR acoustic foundation models.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/50">
          <div className="flex items-center gap-2 font-semibold text-xs text-slate-800 dark:text-slate-100">
            <div className="rounded-lg bg-blue-500/10 p-1.5 text-blue-600">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span>Protokol Triase Klinis WHO</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Hasil klasifikasi akustik dilengkapi reasoning klinis LLM dan batas etis: hasil bukan vonis medis, melainkan rujukan Tes Cepat Molekuler (TCM GeneXpert).
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
