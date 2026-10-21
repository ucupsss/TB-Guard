'use client';

import * as React from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { LiveMicRecorder } from '@/components/tb/LiveMicRecorder';
import { Badge } from '@/components/ui/badge';
import { BrainCircuit, Cpu, ShieldCheck } from 'lucide-react';

export default function LiveTestView() {
  return (
    <AppLayout crumbs={[{ label: 'Uji Suara Mic (Live)' }]}>
      <div className="intro-y mt-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
            Integrasi Pengujian Mikrofon Langsung
            <Badge variant="soft-primary" className="gap-1 text-xs">
              <Cpu className="h-3 w-3 text-primary" /> Edge / Laptop Input
            </Badge>
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Uji kecocokan akustik batuk secara instan menggunakan mikrofon internal laptop atau USB mic eksternal.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <LiveMicRecorder />
      </div>

      {/* Model architecture & Scientific boundary notes */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mb-1.5">
            <BrainCircuit className="h-4 w-4 text-primary" /> Model CWT Scalogram
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Sinyal audio dari mikrofon dikonversi menjadi representasi Morlet Continuous Wavelet Transform (CWT) beresolusi 224x224 sebelum diproses oleh backbone MobileNetV3.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mb-1.5">
            <Cpu className="h-4 w-4 text-emerald-600" /> Pipeline Resampling 16 kHz
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Audio otomatis difilter anti-aliasing dan diseragamkan ke format mono 16.000 Hz, identik dengan data latih Kaggle RespiScan dan HeAR foundation model.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mb-1.5">
            <ShieldCheck className="h-4 w-4 text-blue-600" /> Triase Klinis WHO
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Setiap prediksi didampingi penalaran berbasis LLM yang mencakup penilaian risiko penularan aerosol dan rekomendasi Tes Cepat Molekuler (TCM GeneXpert).
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
