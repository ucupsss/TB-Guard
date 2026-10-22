'use client';

import * as React from 'react';
import { BackpackIcon, CardStackIcon, HomeIcon, IdCardIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

/* Asumsi ilustratif (bukan klaim klinis). Sumber angka dasar: Renaksi TBC Minahasa Utara 2025-2029 dan studi klaim JKN. */
const PRICE_PER_NODE_MONTH = 4_500_000;   // DaaS: Rp 4,5 juta / node / bulan
const CASE_COST = 7_000_000;              // biaya kesehatan + rumah tangga per kasus TB biasa (pemodelan)
const RO_COST = 130_000_000;              // biaya pemerintah per pasien TB-RO (Renaksi)

const nf = (n: number, d = 0) => n.toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: d });
const rp = (v: number) => (Math.abs(v) >= 1e9 ? `Rp ${nf(v / 1e9, 2)} M` : `Rp ${nf(v / 1e6, 1)} jt`);

const STAKEHOLDERS = [
  {
    icon: IdCardIcon, tag: 'B2G', title: 'Kemenkes dan Dinas Kesehatan', pays: 'Pembayar: anggaran program TB nasional/daerah',
    value: 'Deteksi dini sebelum fase penularan droplet aktif memangkas biaya perawatan TB resisten obat, yang bisa mencapai Rp 130 juta (Renaksi) hingga sekitar Rp 200 juta per pasien bila komplikasi dihitung (estimasi).',
    model: 'Lisensi Enterprise Surveillance SaaS dan integrasi SatuSehat.',
  },
  {
    icon: HomeIcon, tag: 'B2B', title: 'PT KAI, bandara, operator fasilitas publik', pays: 'Pembayar: operator fasilitas (anggaran K3 dan ESG)',
    value: 'Memenuhi standar fasilitas publik sehat dan keselamatan kerja (ISO 45001), serta mendongkrak skor ESG.',
    model: 'Device-as-a-Service Rp 4,5 juta per node per bulan, termasuk sensor 3D dan pemeliharaan AI swarm.',
  },
  {
    icon: BackpackIcon, tag: 'B2B', title: 'Faskes swasta dan asuransi', pays: 'Pembayar: faskes dan perusahaan asuransi',
    value: 'Triase otomatis menurunkan beban kerja nakes dan mempercepat alur pemeriksaan TCM GeneXpert.',
    model: 'Langganan per faskes, dengan opsi bagi hasil efisiensi klaim.',
  },
];

/** Siapa yang membayar dan berapa nilainya, plus kalkulator ROI dengan asumsi yang bisa digeser. */
export function CommercializationMatrix() {
  const [nodes, setNodes] = React.useState(10);
  const [cases, setCases] = React.useState(6);
  const [roShare, setRoShare] = React.useState(5);

  const cost = nodes * PRICE_PER_NODE_MONTH * 12;
  const patients = nodes * cases;
  const perCase = CASE_COST + (roShare / 100) * RO_COST;
  const saving = patients * perCase;
  const roi = cost ? (saving - cost) / cost : 0;
  const payback = saving > 0 ? (cost / saving) * 12 : Infinity;
  const breakEven = perCase ? (PRICE_PER_NODE_MONTH * 12) / perCase : Infinity;

  return (
    <div className="grid gap-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Siapa yang membayar</h3>
        <div className="grid gap-4 lg:grid-cols-3">
          {STAKEHOLDERS.map(({ icon: Icon, tag, title, pays, value, model }) => (
            <div key={title} className="box flex flex-col p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                <div className="min-w-0"><Badge variant="outline" className="text-[10px]">{tag}</Badge><div className="mt-1 text-sm font-medium leading-snug text-foreground">{title}</div></div>
              </div>
              <p className="mt-3 text-xs font-medium text-primary">{pays}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground"><b className="text-foreground">Nilai:</b> {value}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground"><b className="text-foreground">Model bisnis:</b> {model}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="box p-4 sm:p-5">
        <div className="flex items-center gap-2"><CardStackIcon className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">Kalkulator ROI</h3></div>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          <div>
            <div className="mb-2 flex justify-between text-xs"><span className="text-muted-foreground">Node terpasang</span><b className="text-foreground">{nodes}</b></div>
            <Slider value={[nodes]} min={1} max={50} step={1} onValueChange={([v]) => setNodes(v)} aria-label="Jumlah node terpasang" />
          </div>
          <div>
            <div className="mb-2 flex justify-between text-xs"><span className="text-muted-foreground">Kasus terjaring dini / node / tahun</span><b className="text-foreground">{cases}</b></div>
            <Slider value={[cases]} min={1} max={12} step={1} onValueChange={([v]) => setCases(v)} aria-label="Kasus terjaring dini per node per tahun" />
          </div>
          <div>
            <div className="mb-2 flex justify-between text-xs"><span className="text-muted-foreground">Kasus yang dicegah jadi TB-RO</span><b className="text-foreground">{roShare}%</b></div>
            <Slider value={[roShare]} min={0} max={15} step={1} onValueChange={([v]) => setRoShare(v)} aria-label="Porsi kasus yang dicegah menjadi TB resisten obat" />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Biaya langganan / tahun" value={rp(cost)} />
          <Stat label="Pasien terjaring dini / tahun" value={nf(patients)} />
          <Stat label="Potensi penghematan negara" value={rp(saving)} />
          <Stat label="ROI" value={`${roi >= 0 ? '+' : ''}${nf(roi * 100, 0)}%`} tone={roi >= 0 ? 'good' : 'bad'}
            hint={Number.isFinite(payback) ? `Balik modal sekitar ${nf(payback, 1)} bulan` : 'Belum balik modal'} />
        </div>

        <p className="mt-4 flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <InfoCircledIcon className="mt-0.5 h-3 w-3 shrink-0" />
          Penghematan = pasien terjaring x (Rp 7 jt biaya kasus TB biasa + porsi TB-RO x Rp 130 jt). Titik impas: {Number.isFinite(breakEven) ? nf(breakEven, 1) : '-'} kasus per node per tahun.
          Seluruh asumsi bersifat ilustratif dan perlu divalidasi lewat uji lapangan dengan kelompok pembanding.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-lg border p-3.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-xl font-semibold tabular-nums', tone === 'good' ? 'text-success' : tone === 'bad' ? 'text-danger' : 'text-foreground')}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
