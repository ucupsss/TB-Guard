'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { Building2, Train, Landmark, HeartHandshake, TrendingUp, Users, Wallet, ShieldAlert } from '@/components/ui/icons';
import { AppLayout } from '@/components/layout/AppLayout';
import { SectionHeader } from '@/components/tb/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/* Angka: Renaksi TBC Minahasa Utara 2025-2029, studi klaim JKN, survei WHO Indonesia 2020, studi beban ekonomi TBC.
   Model ilustratif (bukan estimasi resmi nasional). */
const CASES = 1_090_000; // kasus TBC baru / tahun
const OPEX_M = 50; // biaya operasional aplikasi, miliar Rp / tahun
const nf = (n: number, d = 0) => n.toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: d });
const rpM = (m: number) => (Math.abs(m) >= 1000 ? `Rp${nf(m / 1000, 2)} T` : `Rp${nf(m, 1)} M`);

const SCENARIOS = [
  { v: '2', label: 'Konservatif', pct: 2 },
  { v: '5', label: 'Moderat', pct: 5 },
  { v: '10', label: 'Optimis', pct: 10 },
];

const STATS = [
  { icon: Users, value: '1,09 jt', label: 'kasus TBC baru / tahun', tone: 'text-primary bg-primary/10' },
  { icon: Wallet, value: 'Rp7 jt', label: 'biaya per kasus (kesehatan + keluarga)', tone: 'text-warning bg-warning/10' },
  { icon: ShieldAlert, value: 'Rp136 jt', label: 'biaya per kasus TBC resistan obat', tone: 'text-danger bg-danger/10' },
  { icon: TrendingUp, value: 'US$6,9 M', label: 'beban ekonomi TBC / tahun', tone: 'text-success bg-success/10' },
];

const SEGMENTS = [
  { icon: Train, title: 'Ruang publik padat', note: 'Stasiun, terminal, bandara' },
  { icon: Building2, title: 'Faskes & poli paru', note: 'RS, puskesmas, ruang tunggu' },
  { icon: Landmark, title: 'Pemerintah', note: 'Kemenkes, Dinkes, BPJS' },
  { icon: HeartHandshake, title: 'CSR & donor', note: 'Program eliminasi TBC 2030' },
];

const COST_BARS = [
  { name: 'TBC biasa', jt: 4.48, color: '#1C3FAA' },
  { name: 'TBC resistan obat', jt: 136.31, color: '#E11D48' },
];

function Source({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-muted-foreground hover:text-foreground" aria-label="Sumber data">
          <InfoCircledIcon className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{children}</TooltipContent>
    </Tooltip>
  );
}

export default function Market() {
  const [pct, setPct] = React.useState(5);
  const [cost, setCost] = React.useState(6);

  const prevented = Math.round((CASES * pct) / 100);
  const gross = (prevented * cost) / 1000; // miliar Rp (kasus x juta / 1000)
  const net = gross - OPEX_M;
  const roi = net > 0 ? net / OPEX_M : 0;
  const curve = [1, 2, 5, 10, 15, 20].map((p) => ({
    name: `${p}%`,
    m: Math.round(((CASES * p) / 100) * cost / 1000 - OPEX_M),
    active: p === pct,
  }));
  const scenario = SCENARIOS.find((s) => s.pct === pct)?.v ?? '';

  return (
    <AppLayout crumbs={[{ label: 'Peluang Pasar', to: '/market' }, { label: 'Potensi Pasar' }]}>
      <div className="intro-y mb-6 mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Skrining TB di Ruang Publik: Pasar Nyata</h1>
        <Badge variant="outline" className="ml-auto">Model ilustratif · Indonesia</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {STATS.map(({ icon: Icon, value, label, tone }) => (
          <div key={label} className="box intro-y flex items-center gap-4 p-4 sm:p-5">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="h-5 w-5" /></span>
            <div className="min-w-0">
              <div className="text-xl font-semibold text-foreground sm:text-2xl">{value}</div>
              <div className="text-xs leading-snug text-muted-foreground sm:text-sm">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <SectionHeader title="Kalkulator Penghematan">
            <Source>Kasus baru 1,09 jt/tahun (Kemenkes). Biaya terhindarkan per kasus: asumsi pemodelan dari biaya medis JKN (±Rp5 jt) + rumah tangga (±Rp2 jt).</Source>
          </SectionHeader>
          <div className="box intro-y p-5 sm:p-6">
            <ToggleGroup
              type="single"
              value={scenario}
              onValueChange={(v) => { const s = SCENARIOS.find((x) => x.v === v); if (s) setPct(s.pct); }}
              className="flex flex-wrap justify-start gap-2"
            >
              {SCENARIOS.map((s) => (
                <ToggleGroupItem key={s.v} value={s.v} className="px-4">{s.label} · {s.pct}%</ToggleGroupItem>
              ))}
            </ToggleGroup>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <div className="mb-3 flex justify-between text-sm"><span className="text-muted-foreground">Penurunan kasus</span><b className="text-foreground">{nf(pct, 1)}%</b></div>
                <Slider value={[pct]} min={0} max={20} step={0.5} onValueChange={([v]) => setPct(v)} aria-label="Penurunan kasus" />
              </div>
              <div>
                <div className="mb-3 flex justify-between text-sm"><span className="text-muted-foreground">Biaya terhindarkan / kasus</span><b className="text-foreground">Rp{nf(cost, 1)} jt</b></div>
                <Slider value={[cost]} min={4} max={10} step={0.5} onValueChange={([v]) => setCost(v)} aria-label="Biaya terhindarkan per kasus" />
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md bg-primary/5 p-4"><div className="text-xs text-muted-foreground">Kasus dicegah / tahun</div><div className="mt-1 text-xl font-semibold text-foreground">{nf(prevented)}</div></div>
              <div className="rounded-md bg-primary/5 p-4"><div className="text-xs text-muted-foreground">Penghematan kotor</div><div className="mt-1 text-xl font-semibold text-foreground">{rpM(gross)}</div></div>
              <div className="rounded-md bg-success/10 p-4"><div className="text-xs text-muted-foreground">Penghematan bersih</div><div className="mt-1 text-xl font-semibold text-success">{rpM(net)}</div></div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Setelah biaya operasional Rp{OPEX_M} M/tahun · {roi > 0 ? `${nf(roi, 1)}x` : '–'} dari biaya operasional.</p>

            <div className="mt-5 h-40" aria-label="Penghematan bersih per skenario penurunan kasus">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={curve} margin={{ top: 16, right: 4, left: 4, bottom: 0 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis hide />
                  <Bar dataKey="m" radius={[4, 4, 0, 0]}>
                    {curve.map((c) => <Cell key={c.name} fill={c.active ? '#1C3FAA' : '#94A3B8'} fillOpacity={c.active ? 1 : 0.45} />)}
                    <LabelList dataKey="m" position="top" formatter={(v: unknown) => rpM(Number(v))} style={{ fontSize: 11 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="xl:col-span-2">
          <SectionHeader title="Mengapa Deteksi Dini">
            <Source>Renaksi Penanggulangan TBC Kab. Minahasa Utara 2025–2029: total biaya langsung + non-medis keluarga per pasien (estimasi perencanaan).</Source>
          </SectionHeader>
          <div className="box intro-y p-5 sm:p-6">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={COST_BARS} layout="vertical" margin={{ top: 4, right: 64, left: 8, bottom: 4 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={110} tick={{ fontSize: 12 }} />
                  <Bar dataKey="jt" radius={[0, 4, 4, 0]} barSize={26}>
                    {COST_BARS.map((c) => <Cell key={c.name} fill={c.color} />)}
                    <LabelList dataKey="jt" position="right" formatter={(v: unknown) => `Rp${nf(Number(v), 1)} jt`} style={{ fontSize: 12 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-sm text-foreground">Kasus terlambat ditemukan berisiko jadi resistan obat: <b className="text-danger">±30x lebih mahal</b>.</p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <SectionHeader title="Siapa yang Membeli" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {SEGMENTS.map(({ icon: Icon, title, note }) => (
            <div key={title} className="box intro-y p-4 sm:p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
              <div className="mt-3 font-medium text-foreground">{title}</div>
              <div className="text-sm text-muted-foreground">{note}</div>
            </div>
          ))}
        </div>
      </div>

      <p className="mb-4 mt-6 text-xs text-muted-foreground">
        Sumber: Kemenkes, analisis klaim JKN, survei WHO Indonesia 2020, Renaksi TBC Minahasa Utara 2025–2029. Angka berupa estimasi pemodelan; klaim kasus dicegah perlu dibuktikan terhadap kelompok pembanding.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/60 pt-4 dark:border-white/10">
        <div className="text-xs text-muted-foreground">
          Ingin melihat detail analisis pembayar B2B/B2G dan peraturan pemerintah yang mendasari?
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/market/business">
            Buka Potensi Bisnis &amp; Regulasi ↗
          </Link>
        </Button>
      </div>
    </AppLayout>
  );
}
