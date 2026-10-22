'use client';

import { AppLayout } from '@/components/layout/AppLayout';
import { LiveMicRecorder } from '@/components/tb/LiveMicRecorder';
import { Badge } from '@/components/ui/badge';

export default function LiveTestView() {
  return (
    <AppLayout crumbs={[{ label: 'Uji Suara Mikrofon' }]}>
      <div className="intro-y mt-8 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-medium">Uji Suara Mikrofon &amp; Deteksi TB</h2>
        <span title="Sinyal mikrofon diubah menjadi matriks waktu-frekuensi Morlet CWT 224×224 pada pita 1,2–3,5 kHz.">
          <Badge variant="soft-primary">MobileNetV3 + CWT</Badge>
        </span>
        <span title="Rekaman dinormalisasi ke 16 kHz mono, sama dengan standar dataset Kaggle RespiScan dan HeAR.">
          <Badge variant="soft-success">16 kHz Resampled</Badge>
        </span>
      </div>

      <div className="mt-5">
        <LiveMicRecorder />
      </div>
    </AppLayout>
  );
}
