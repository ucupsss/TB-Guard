'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import {
  InfoCircledIcon,
  Cross2Icon,
  MinusIcon,
  ChevronUpIcon,
  MagicWandIcon,
  ExternalLinkIcon,
} from '@radix-ui/react-icons';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/* Data pemodelan nasional TBC Indonesia (Kemenkes & Renaksi):
   Kasus baru: 1.090.000 / tahun. Biaya operasional platform: Rp50 M / tahun. */
const CASES = 1_090_000;
const OPEX_M = 50;

const nf = (n: number, d = 0) =>
  n.toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: d });

const rpM = (m: number) =>
  Math.abs(m) >= 1000 ? `Rp${nf(m / 1000, 2)} T` : `Rp${nf(m, 1)} M`;

const SCENARIOS = [
  { v: '2', label: 'Konservatif', pct: 2 },
  { v: '5', label: 'Moderat', pct: 5 },
  { v: '10', label: 'Optimis', pct: 10 },
];

function CalculatorIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <line x1="8" x2="16" y1="6" y2="6" />
      <line x1="16" x2="16" y1="14" />
      <path d="M16 10h.01" />
      <path d="M12 10h.01" />
      <path d="M8 10h.01" />
      <path d="M12 14h.01" />
      <path d="M8 14h.01" />
      <path d="M12 18h.01" />
      <path d="M8 18h.01" />
    </svg>
  );
}

export function SavingsCalculatorPopup() {
  // Dimulai terbuka; bisa diminimize menjadi flat bar/pill di pojok kiri bawah
  const [minimized, setMinimized] = React.useState(false);
  const [pct, setPct] = React.useState(17);
  const [cost, setCost] = React.useState(6);

  const prevented = Math.round((CASES * pct) / 100);
  const gross = (prevented * cost) / 1000; // miliar Rp
  const net = gross - OPEX_M;
  const roi = net > 0 ? net / OPEX_M : 0;

  const curve = [1, 2, 5, 10, 15, 20].map((p) => ({
    name: `${p}%`,
    m: Math.round(((CASES * p) / 100) * (cost / 1000) - OPEX_M),
    active: Math.abs(p - pct) < 2.5,
  }));

  const scenario = SCENARIOS.find((s) => s.pct === pct)?.v ?? '';

  return (
    /* FIXED di pojok kiri bawah: tidak akan pernah ikut terscroll */
    <aside
      aria-label="Kalkulator Penghematan TB Guard"
      className="pointer-events-auto fixed bottom-5 left-5 z-50 select-none"
    >
      {minimized ? (
        /* Flat bar / pill saat diminimize */
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-left shadow-lg transition-all duration-200 hover:border-primary/50 hover:shadow-xl dark:bg-card"
          title="Buka kembali kalkulator penghematan"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
            <CalculatorIcon className="h-4 w-4" />
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Kalkulator Penghematan</span>
              <Badge variant="soft-success" className="px-1.5 py-0 text-[10px] font-bold">
                +{rpM(net)}
              </Badge>
            </div>
            <span className="text-[10px] text-muted-foreground">Klik untuk coba simulasi juri ↗</span>
          </div>
          <ChevronUpIcon className="ml-1 h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:text-foreground" />
        </button>
      ) : (
        /* Flat Card saat diperluas */
        <div className="flex max-h-[calc(100dvh-60px)] w-[360px] max-w-[calc(100vw-32px)] flex-col rounded-2xl border border-border bg-card p-4 shadow-2xl transition-all duration-200 dark:bg-card sm:w-[420px] sm:p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalculatorIcon className="h-4 w-4" />
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-foreground sm:text-base">
                    Kalkulator Penghematan
                  </h3>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex text-muted-foreground hover:text-foreground"
                        aria-label="Sumber data"
                      >
                        <InfoCircledIcon className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Estimasi berdasarkan 1,09 jt kasus TBC baru/tahun (Kemenkes) &amp; biaya medis JKN + beban keluarga per pasien.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Simulasi interaktif dampak ekonomi nasional
                </p>
              </div>
            </div>

            {/* Tombol Minimize & Close */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMinimized(true)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Minimize Kalkulator"
                aria-label="Minimize"
              >
                <MinusIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setMinimized(true)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Tutup / Minimize"
                aria-label="Tutup"
              >
                <Cross2Icon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto pr-1">
            {/* Skenario Preset */}
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Preset Skenario:</span>
                <span className="flex items-center gap-1 font-medium text-primary">
                  <MagicWandIcon className="h-3 w-3" /> Rekomendasi Juri
                </span>
              </div>
              <ToggleGroup
                type="single"
                value={scenario}
                onValueChange={(v) => {
                  const s = SCENARIOS.find((x) => x.v === v);
                  if (s) setPct(s.pct);
                }}
                className="flex w-full justify-start gap-1.5"
              >
                {SCENARIOS.map((s) => (
                  <ToggleGroupItem
                    key={s.v}
                    value={s.v}
                    className="flex-1 rounded-lg border border-border px-2 py-1 text-xs data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-white"
                  >
                    {s.label} · {s.pct}%
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            {/* Sliders Input */}
            <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-xl border border-border/50 bg-muted/40 p-2.5">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Penurunan kasus</span>
                  <b className="font-semibold text-primary">{nf(pct, 1)}%</b>
                </div>
                <Slider
                  value={[pct]}
                  min={0}
                  max={25}
                  step={0.5}
                  onValueChange={([v]) => setPct(v)}
                  aria-label="Penurunan kasus"
                />
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/40 p-2.5">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Biaya / kasus</span>
                  <b className="font-semibold text-primary">Rp{nf(cost, 1)} jt</b>
                </div>
                <Slider
                  value={[cost]}
                  min={4}
                  max={10}
                  step={0.5}
                  onValueChange={([v]) => setCost(v)}
                  aria-label="Biaya terhindarkan per kasus"
                />
              </div>
            </div>

            {/* 3 Metrik Utama */}
            <div className="mt-3.5 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border/50 bg-primary/5 p-2.5 text-center">
                <div className="text-[10px] leading-tight text-muted-foreground">Kasus dicegah / thn</div>
                <div className="mt-1 text-sm font-bold text-foreground sm:text-base">
                  {nf(prevented)}
                </div>
              </div>
              <div className="rounded-xl border border-border/50 bg-primary/5 p-2.5 text-center">
                <div className="text-[10px] leading-tight text-muted-foreground">Penghematan kotor</div>
                <div className="mt-1 text-sm font-bold text-foreground sm:text-base">
                  {rpM(gross)}
                </div>
              </div>
              <div className="rounded-xl border border-success/30 bg-success/10 p-2.5 text-center">
                <div className="text-[10px] leading-tight text-success font-medium">
                  Penghematan bersih
                </div>
                <div className="mt-1 text-sm font-bold text-success sm:text-base">
                  {rpM(net)}
                </div>
              </div>
            </div>

            {/* ROI Note */}
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Setelah biaya operasional Rp{OPEX_M} M/tahun ·{' '}
              <strong className="text-foreground">{roi > 0 ? `${nf(roi, 1)}x` : '–'}</strong> dari biaya operasional.
            </p>

            {/* Visualisasi Kurva Skenario */}
            <div className="mt-3 rounded-xl border border-border/60 bg-muted/20 p-2">
              <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Kurva Penghematan Bersih:</span>
                <span className="font-mono text-[9px]">1% → 20%</span>
              </div>
              <div className="h-28 w-full" aria-label="Grafik perbandingan penghematan">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={curve} margin={{ top: 16, right: 4, left: 4, bottom: 0 }}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <YAxis hide />
                    <Bar dataKey="m" radius={[4, 4, 0, 0]}>
                      {curve.map((c) => (
                        <Cell
                          key={c.name}
                          fill={c.active ? '#1C3FAA' : '#94A3B8'}
                          fillOpacity={c.active ? 1 : 0.45}
                        />
                      ))}
                      <LabelList
                        dataKey="m"
                        position="top"
                        formatter={(v: unknown) => rpM(Number(v))}
                        style={{ fontSize: 9, fontWeight: 600, fill: 'currentColor' }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[11px]">
              <span className="text-[10px] text-muted-foreground">Model simulasi Indonesia</span>
              <Link
                href="/market"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                Analisis Pasar Lengkap <ExternalLinkIcon className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
