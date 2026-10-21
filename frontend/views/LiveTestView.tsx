'use client';

import * as React from 'react';
import { CheckCircledIcon, LayersIcon, MixerVerticalIcon } from '@radix-ui/react-icons';
import { AppLayout } from '@/components/layout/AppLayout';
import { LiveMicRecorder } from '@/components/tb/LiveMicRecorder';
import { Badge } from '@/components/ui/badge';

const NOTES = [
  { icon: LayersIcon, color: 'text-primary dark:text-blue-300', title: 'Representasi CWT Scalogram',
    text: 'Sinyal audio mikrofon dikonversi menjadi time-frequency matrix Morlet CWT 224×224 yang merepresentasikan konsentrasi energi batuk pada spektrum 1.2 – 3.5 kHz.' },
  { icon: MixerVerticalIcon, color: 'text-success', title: 'Anti-Aliased 16 kHz Mono',
    text: 'Pipeline audio menormalisasi rekaman mikrofon agar identik dengan standar dataset Kaggle RespiScan dan HeAR acoustic foundation models.' },
  { icon: CheckCircledIcon, color: 'text-pending', title: 'Protokol Triase Klinis WHO',
    text: 'Hasil klasifikasi akustik dilengkapi reasoning klinis dan batas etis: hasil bukan vonis medis, melainkan rujukan Tes Cepat Molekuler (TCM GeneXpert).' },
];

export default function LiveTestView() {
  return (
    <AppLayout crumbs={[{ label: 'Uji Suara Mikrofon' }]}>
      <div className="intro-y mt-8 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-medium">Uji Suara Mikrofon &amp; Deteksi TB</h2>
        <Badge variant="soft-primary">MobileNetV3 + CWT</Badge>
        <Badge variant="soft-success">16 kHz Resampled</Badge>
      </div>
      <p className="intro-y mt-1 text-muted-foreground">
        Pengujian akustik batuk secara langsung melalui mikrofon laptop atau USB external mic dengan validasi CWT Morlet.
      </p>

      <div className="mt-5">
        <LiveMicRecorder />
      </div>

      <div className="mt-6 grid grid-cols-12 gap-6">
        {NOTES.map(({ icon: Icon, color, title, text }) => (
          <div key={title} className="intro-y box col-span-12 p-5 md:col-span-4">
            <div className="flex items-center gap-2 font-medium"><Icon className={`h-4 w-4 ${color}`} />{title}</div>
            <p className="mt-2 leading-relaxed text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
