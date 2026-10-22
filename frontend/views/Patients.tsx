'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  Calendar,
  Building2,
  User,
  Stethoscope,
  Activity,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  MoreVertical,
  X,
  Filter,
  Check,
  Info,
  RotateCcw,
  Mic,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PersonAvatar } from '@/components/tb/common';
import { useStore, NOW, STAGES } from '@/lib/store';
import { fmt } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Patient } from '@/lib/types';

// Standar Faskes dan Dokter TB-Guard
const FACILITIES = [
  'Semua Faskes',
  'RSKI Universitas Airlangga',
  'Puskesmas Gubeng',
  'Puskesmas Tambaksari',
  'RSUD Dr. Soetomo',
];

const CLINICIANS = [
  'dr. Rahma (Sp.P)',
  'dr. Wibowo (Sp.P)',
  'Ns. Maya (Koordinator DOTS)',
  'Ns. Fikri (Surveilans TB)',
];

// Konfigurasi visual 5 Tahap Pelacakan Pasien
interface StageMeta {
  name: string;
  shortLabel: string;
  sublabel: string;
  hint: string;
  colorDot: string;
  badgeClass: string;
  borderClass: string;
  headerBg: string;
  nextActionName: string;
}

const STAGE_CONFIG: StageMeta[] = [
  {
    name: 'Terdeteksi',
    shortLabel: 'Skrining AI',
    sublabel: 'Skrining Akustik (Non-Diagnostik)',
    hint: 'Terindikasi akustik batuk dari sensor IoT / mic',
    colorDot: 'bg-rose-500',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50',
    borderClass: 'border-l-rose-500',
    headerBg: 'bg-rose-500/10 border-rose-200 dark:border-rose-900/30',
    nextActionName: 'Rujuk ke Skrining Lanjut (TCM / Dahak)',
  },
  {
    name: 'Skrining Lanjut',
    shortLabel: 'Pemeriksaan Lab',
    sublabel: 'Rujukan Sputum & TCM',
    hint: 'Pengambilan dahak / Tes Cepat Molekuler di faskes',
    colorDot: 'bg-amber-500',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50',
    borderClass: 'border-l-amber-500',
    headerBg: 'bg-amber-500/10 border-amber-200 dark:border-amber-900/30',
    nextActionName: 'Verifikasi Lab & Konfirmasi TB',
  },
  {
    name: 'Terkonfirmasi',
    shortLabel: 'TB Terverifikasi',
    sublabel: 'Bakteriologis / Klinis Positif',
    hint: 'Diagnosis definitif TB terverifikasi dokter spesialis',
    colorDot: 'bg-indigo-600',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/50',
    borderClass: 'border-l-indigo-600',
    headerBg: 'bg-indigo-500/10 border-indigo-200 dark:border-indigo-900/30',
    nextActionName: 'Mulai Protokol Pengobatan OAT',
  },
  {
    name: 'Pengobatan',
    shortLabel: 'Terapi DOTS',
    sublabel: 'Regimen OAT Aktif (DOTS)',
    hint: 'Pemantauan minum obat fase intensif / lanjutan',
    colorDot: 'bg-blue-600',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50',
    borderClass: 'border-l-blue-600',
    headerBg: 'bg-blue-500/10 border-blue-200 dark:border-blue-900/30',
    nextActionName: 'Evaluasi Akhir & Nyatakan Sembuh',
  },
  {
    name: 'Sembuh',
    shortLabel: 'Pengobatan Lengkap',
    sublabel: 'Pengobatan Lengkap & Sembuh',
    hint: 'Regimen tuntas, konversi dahak negatif, sembuh',
    colorDot: 'bg-emerald-600',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50',
    borderClass: 'border-l-emerald-600',
    headerBg: 'bg-emerald-500/10 border-emerald-200 dark:border-emerald-900/30',
    nextActionName: 'Arsipkan Rekam Medis (Selesai)',
  },
];

export default function Patients() {
  const { patients, addPatient, updatePatient, detection } = useStore();
  const searchParams = useSearchParams();

  // Search & Filters State
  const [query, setQuery] = React.useState('');
  const [selectedStage, setSelectedStage] = React.useState<number | null>(null);
  const [selectedFacility, setSelectedFacility] = React.useState<string>('Semua Faskes');

  // Detail Sheet State
  const [activePatient, setActivePatient] = React.useState<Patient | null>(() => {
    const openId = searchParams?.get('open');
    return patients.find((p) => p.id === openId) ?? null;
  });

  // Dialog States
  const [creating, setCreating] = React.useState(false);
  const [advanceDialogPatient, setAdvanceDialogPatient] = React.useState<Patient | null>(null);
  const [advanceNote, setAdvanceNote] = React.useState('');
  const [newLogNote, setNewLogNote] = React.useState('');

  // Audio Detection Banner
  const fromDet = searchParams?.get('from') ? detection(searchParams.get('from')!) : undefined;
  const [bannerVisible, setBannerVisible] = React.useState(true);

  // New Patient Form State
  const [form, setForm] = React.useState({
    name: '',
    gender: 'L' as 'L' | 'P',
    age: '',
    phone: '',
    nik: '',
    facility: FACILITIES[1],
    pic: CLINICIANS[0],
    uuid: '',
    notes: '',
  });
  const [formError, setFormError] = React.useState('');

  // Sinkronisasi activePatient jika daftar pasien di store diperbarui
  React.useEffect(() => {
    if (activePatient) {
      const refreshed = patients.find((p) => p.id === activePatient.id);
      if (refreshed) setActivePatient(refreshed);
    }
  }, [patients, activePatient]);

  // Total dan Perhitungan Proporsi Nyata
  const totalPatients = patients.length;

  // Filter Pasien secara reaktif
  const filteredPatients = React.useMemo(() => {
    return patients.filter((p) => {
      // 1. Stage filter
      if (selectedStage !== null && p.stage !== selectedStage) {
        return false;
      }
      // 2. Facility filter
      if (selectedFacility !== 'Semua Faskes' && p.facility !== selectedFacility) {
        return false;
      }
      // 3. Text search
      if (query.trim()) {
        const q = query.toLowerCase();
        const searchPool = [p.name, p.id, p.facility, p.pic, p.nik, p.uuid].join(' ').toLowerCase();
        if (!searchPool.includes(q)) return false;
      }
      return true;
    });
  }, [patients, selectedStage, selectedFacility, query]);

  // Reset semua filter
  const isFiltered = query.trim() !== '' || selectedStage !== null || selectedFacility !== 'Semua Faskes';
  const handleResetFilters = () => {
    setQuery('');
    setSelectedStage(null);
    setSelectedFacility('Semua Faskes');
  };

  // Mulai pendaftaran baru
  const startNew = (pref?: Partial<typeof form>) => {
    setForm({
      name: '',
      gender: 'L',
      age: '',
      phone: '',
      nik: '',
      facility: FACILITIES[1],
      pic: CLINICIANS[0],
      uuid: '',
      notes: '',
      ...pref,
    });
    setFormError('');
    setCreating(true);
  };

  // Submit Registrasi Pasien Baru
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('Nama lengkap pasien wajib diisi.');
      return;
    }

    const now = NOW.getTime();
    const newId = 'PSN-' + (2600 + patients.length);
    const maskedNik = form.nik.trim()
      ? form.nik.trim().slice(0, 4) + '••••••••' + form.nik.trim().slice(-4)
      : '3578••••••••' + Math.floor(1000 + Math.random() * 9000);

    const initialEventText = form.uuid
      ? `Terdaftar dari rujukan skrining akustik (UUID ${form.uuid}). Rencana penjadwalan pemeriksaan sputum.`
      : 'Pendaftaran manual baru ke alur pelacakan terindikasi batuk TB.';

    const newPatient: Patient = {
      id: newId,
      name: form.name.trim(),
      gender: form.gender,
      age: form.age ? Number(form.age) : '–',
      nik: maskedNik,
      phone: form.phone.trim() || '–',
      facility: form.facility,
      stage: 0,
      start: now,
      daysIn: 0,
      uuid: form.uuid.trim() || '—',
      adherence: null,
      nextVisit: now + 3 * 86400000, // Jadwal kontrol 3 hari kemudian
      pic: form.pic,
      events: [
        {
          stage: 0,
          t: now,
          text: initialEventText,
        },
      ],
    };

    addPatient(newPatient);
    setCreating(false);
    setBannerVisible(false);
    toast.success(`Pasien ${form.name.trim()} berhasil didaftarkan`, {
      description: `ID: ${newId} · Tahap: Terdeteksi. Menunggu jadwal skrining lanjutan.`,
    });
  };

  // Tindakan Naikkan Tahap (Advance Stage) dengan Konfirmasi
  const handleOpenAdvanceDialog = (p: Patient) => {
    if (p.stage >= 4) {
      toast.info('Pasien telah berada pada tahap akhir (Sembuh).');
      return;
    }
    setAdvanceDialogPatient(p);
    setAdvanceNote('');
  };

  const handleConfirmAdvance = () => {
    if (!advanceDialogPatient) return;
    const current = advanceDialogPatient;
    const nextStage = current.stage + 1;
    const now = NOW.getTime();

    const stageNote = advanceNote.trim()
      ? advanceNote.trim()
      : `Status ditingkatkan ke ${STAGES[nextStage]} oleh ${current.pic}.`;

    const updatedEvents = [
      ...current.events,
      {
        stage: nextStage,
        t: now,
        text: stageNote,
      },
    ];

    // Jika masuk pengobatan, inisialisasi kepatuhan awal
    const adherenceVal = nextStage === 3 ? 100 : nextStage === 4 ? 100 : current.adherence;
    const nextVisitVal = nextStage === 4 ? null : now + 14 * 86400000;

    updatePatient(current.id, {
      stage: nextStage,
      adherence: adherenceVal,
      nextVisit: nextVisitVal,
      events: updatedEvents,
    });

    toast.success(`Tahap pasien ${current.name} diperbarui`, {
      description: `Sekarang berada pada tahap: ${STAGES[nextStage]}`,
    });

    setAdvanceDialogPatient(null);
  };

  // Menambah Catatan Medis Langsung di Drawer
  const handleAddLogNote = () => {
    if (!activePatient || !newLogNote.trim()) return;
    const now = NOW.getTime();
    const updatedEvents = [
      ...activePatient.events,
      {
        stage: activePatient.stage,
        t: now,
        text: newLogNote.trim(),
      },
    ];

    updatePatient(activePatient.id, { events: updatedEvents });
    setNewLogNote('');
    toast.success('Catatan perkembangan medis berhasil ditambahkan.');
  };

  // Menyesuaikan Jadwal Kontrol Pasien
  const handleReschedule = (daysFromNow: number) => {
    if (!activePatient) return;
    const now = NOW.getTime();
    const newVisitTime = now + daysFromNow * 86400000;
    const eventText = `Jadwal kontrol diperbarui ke ${fmt.date(newVisitTime)} (+${daysFromNow} hari).`;

    const updatedEvents = [
      ...activePatient.events,
      {
        stage: activePatient.stage,
        t: now,
        text: eventText,
      },
    ];

    updatePatient(activePatient.id, {
      nextVisit: newVisitTime,
      events: updatedEvents,
    });

    toast.success('Jadwal kontrol berhasil disesuaikan', {
      description: fmt.date(newVisitTime),
    });
  };

  return (
    <AppLayout crumbs={[{ label: 'Pelacakan Pasien' }]}>
      {/* 1. Page Header */}
      <div className="intro-y mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl" title="Deteksi akustik → verifikasi TCM/dahak → terapi OAT → sembuh">
              Pelacakan Pasien
            </h1>
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary text-xs font-semibold px-2 py-0.5">
              Kohort
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            onClick={() => startNew()}
            className="shadow-sm font-medium gap-1.5 px-4"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah</span>
          </Button>
        </div>
      </div>

      {/* Acoustic Detection Alert Banner (Jika datang dari halaman deteksi / param `from`) */}
      {fromDet && bannerVisible && (
        <div className="intro-y mt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50/90 p-4 text-amber-900 shadow-sm dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold text-sm" title="Deteksi akustik = penapisan awal (non-diagnostik). Daftarkan pasien untuk skrining klinis & TCM.">
                Rujukan <span className="font-mono">{fromDet.uuid}</span> · {(fromDet.confidence * 100).toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 bg-white hover:bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-100 h-8 text-xs font-medium"
              onClick={() =>
                startNew({
                  uuid: fromDet.uuid,
                  name: fromDet.name || '',
                  age: String(fromDet.age || ''),
                  gender: (fromDet.gender as 'L' | 'P') || 'L',
                })
              }
            >
              Isi Data Pasien
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-amber-700 hover:text-amber-900 dark:text-amber-400"
              onClick={() => setBannerVisible(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Medical Safety & Compliance Header Callout */}
      <div className="intro-y mt-4 flex items-center justify-between gap-3 rounded-md border border-slate-200/90 bg-white px-3.5 py-2.5 text-xs text-slate-600 shadow-xs dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
          <span title="Deteksi akustik AI = penapisan awal. Diagnosis definitif wajib lewat verifikasi klinis & lab (TCM / BTA).">
            Bukan diagnosis · wajib verifikasi TCM / BTA
          </span>
        </div>
        <span className="hidden sm:inline-block font-mono text-[11px] text-muted-foreground">
          DOTS WHO
        </span>
      </div>

      {/* 2. Summary Status Cards (5 Stages) */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {STAGE_CONFIG.map((cfg, idx) => {
          const count = patients.filter((p) => p.stage === idx).length;
          const pctCohort = totalPatients > 0 ? Math.round((count / totalPatients) * 100) : 0;
          const isSelected = selectedStage === idx;

          return (
            <button
              key={cfg.name}
              type="button"
              onClick={() => setSelectedStage(isSelected ? null : idx)}
              className={cn(
                'group relative flex flex-col justify-between rounded-lg border bg-card p-4 text-left transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5',
                isSelected
                  ? 'border-primary ring-2 ring-primary/30 shadow-md bg-primary/[0.02]'
                  : 'border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              )}
            >
              {/* Header card: Stage Indicator & Badge */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Tahap {idx + 1}
                </span>
                <span className={cn('h-2 w-2 rounded-full', cfg.colorDot)} />
              </div>

              {/* Patient Count & Stage Name */}
              <div className="mt-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {count}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">pasien</span>
                </div>
                <div className="mt-1 font-semibold text-sm text-foreground line-clamp-1" title={cfg.sublabel}>
                  {cfg.name}
                </div>
              </div>

              {/* Real Metric Progress Bar (Proportion of Cohort) */}
              <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                  <span>Porsi</span>
                  <span className="font-semibold text-foreground">{pctCohort}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800">
                  <div
                    className={cn('h-full rounded-full transition-all duration-300', cfg.colorDot)}
                    style={{ width: `${pctCohort}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Search and Filters Toolbar */}
      <div className="intro-y mt-6 flex flex-col gap-3 rounded-lg border border-slate-200/90 bg-card p-3 shadow-xs dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:items-center">
          {/* Live Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari pasien…"
              className="pl-9 pr-8 h-9 text-sm bg-background border-slate-200 dark:border-slate-700"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Faskes Dropdown */}
          <div className="w-full sm:w-60">
            <Select value={selectedFacility} onValueChange={setSelectedFacility}>
              <SelectTrigger className="h-9 text-sm bg-background border-slate-200 dark:border-slate-700">
                <Building2 className="mr-2 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Pilih Faskes" />
              </SelectTrigger>
              <SelectContent>
                {FACILITIES.map((f) => (
                  <SelectItem key={f} value={f} className="text-sm">
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter Tahap Dropdown (Quick select) */}
          <div className="w-full sm:w-52">
            <Select
              value={selectedStage === null ? 'all' : String(selectedStage)}
              onValueChange={(val) => setSelectedStage(val === 'all' ? null : Number(val))}
            >
              <SelectTrigger className="h-9 text-sm bg-background border-slate-200 dark:border-slate-700">
                <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Semua Tahap" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-sm">
                  Semua Tahap (5)
                </SelectItem>
                {STAGES.map((s, i) => (
                  <SelectItem key={s} value={String(i)} className="text-sm">
                    {i + 1}. {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status Count & Clear Action */}
        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-muted-foreground pt-1 sm:pt-0">
          <span>
            <b className="text-foreground">{filteredPatients.length}</b>/{totalPatients}
          </span>
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-8 gap-1 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Filter
            </Button>
          )}
        </div>
      </div>

      {/* 4. Kanban Patient Tracking Board */}
      <div className="mt-5 flex gap-4 overflow-x-auto pb-6 pt-1 snap-x">
        {STAGE_CONFIG.map((cfg, stageIdx) => {
          // Jika pengguna memfilter tahap tertentu, kita bisa tetap tampilkan semua kolom tapi highlight,
          // atau jika selectedStage diaktifkan, hanya sembunyikan jika mau. Lebih baik tampilkan semua kolom dengan visual fokus, atau tampilkan yang relevan jika diatur.
          if (selectedStage !== null && selectedStage !== stageIdx) {
            return null;
          }

          const columnPatients = filteredPatients.filter((p) => p.stage === stageIdx);

          return (
            <div
              key={cfg.name}
              className="flex flex-col min-w-[285px] w-[285px] xl:w-auto xl:flex-1 shrink-0 rounded-xl border border-slate-200/90 bg-slate-100/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/40"
            >
              {/* Column Header */}
              <div className="mb-3 flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full', cfg.colorDot)} />
                  <span className="font-semibold text-sm text-foreground" title={cfg.hint}>{cfg.name}</span>
                </div>
                <Badge
                  variant="secondary"
                  className="font-bold text-xs bg-white text-foreground shadow-2xs dark:bg-slate-800"
                >
                  {columnPatients.length}
                </Badge>
              </div>


              {/* Patient Cards Stack */}
              <div className="flex flex-col gap-3 min-h-[350px]">
                {columnPatients.map((patient) => {
                  const hasAcoustic = patient.uuid && patient.uuid !== '—';

                  return (
                    <div
                      key={patient.id}
                      onClick={() => setActivePatient(patient)}
                      className={cn(
                        'group relative rounded-lg border border-slate-200/90 bg-card p-3.5 text-left transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md hover:border-primary/50 hover:-translate-y-0.5 dark:border-slate-800/90 dark:hover:border-primary/40',
                        activePatient?.id === patient.id && 'ring-2 ring-primary border-primary'
                      )}
                    >
                      {/* Top Row: Avatar, Name, ID, Overflow Menu */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <PersonAvatar name={patient.name} className="h-9 w-9 shrink-0 ring-1 ring-slate-200 dark:ring-slate-700" />
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                              {patient.name}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="font-mono text-[11px] font-medium text-slate-700 dark:text-slate-300">
                                {patient.id}
                              </span>
                              <span>·</span>
                              <span>
                                {patient.gender === 'L' ? 'L' : 'P'}, {patient.age} th
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground opacity-80 group-hover:opacity-100"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 text-xs">
                            <DropdownMenuLabel>Tindakan Pasien</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setActivePatient(patient);
                              }}
                            >
                              <FileText className="mr-2 h-3.5 w-3.5" />
                              Buka Rekam Medis
                            </DropdownMenuItem>
                            {patient.stage < 4 && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenAdvanceDialog(patient);
                                }}
                              >
                                <ArrowRight className="mr-2 h-3.5 w-3.5 text-primary" />
                                Tingkatkan Tahap
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setActivePatient(patient);
                              }}
                            >
                              <Calendar className="mr-2 h-3.5 w-3.5" />
                              Jadwalkan Kontrol
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <div className="px-2 py-1 text-[10px] text-muted-foreground">
                              PIC: {patient.pic}
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Medical Provenance / Screening Source Tag */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {hasAcoustic ? (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            <Mic className="h-2.5 w-2.5 text-primary" />
                            {patient.uuid}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            <Stethoscope className="h-2.5 w-2.5 text-slate-500" />
                            Rujukan Langsung
                          </span>
                        )}

                        <span className="inline-flex items-center rounded border border-slate-200/80 px-1.5 py-0.5 text-[10px] text-muted-foreground dark:border-slate-800">
                          H+{patient.daysIn}
                        </span>
                      </div>

                      {/* Facility & Clinician Info */}
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5 truncate">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{patient.facility}</span>
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{patient.pic}</span>
                        </div>
                      </div>

                      {/* Real Adherence Progress (HANYA jika tahap Pengobatan) */}
                      {patient.stage === 3 && patient.adherence != null && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-[11px] text-muted-foreground">OAT</span>
                            <span className={cn('font-semibold text-xs', patient.adherence >= 85 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                              {patient.adherence}%
                            </span>
                          </div>
                          <Progress
                            value={patient.adherence}
                            className="h-1.5"
                            indicatorClassName={patient.adherence >= 85 ? 'bg-emerald-500' : 'bg-amber-500'}
                          />
                        </div>
                      )}

                      {/* Card Footer: Follow-up Control Date */}
                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-[11px]">
                            {patient.nextVisit ? (
                              <>
                                Kontrol:{' '}
                                <b className="text-foreground font-medium">
                                  {fmt.dayShort(patient.nextVisit)}
                                </b>
                              </>
                            ) : (
                              <span className="text-emerald-600 font-medium dark:text-emerald-400">
                                Selesai
                              </span>
                            )}
                          </span>
                        </div>

                        <span className="text-[11px] font-medium text-primary flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                          Detail <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Empty State dalam kolom */}
                {columnPatients.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300/80 bg-white/40 p-6 text-center text-xs text-muted-foreground dark:border-slate-700/60 dark:bg-slate-900/20">
                    <CheckCircle2 className="h-6 w-6 text-slate-300 dark:text-slate-700 mb-2" />
                    <p className="font-medium text-slate-600 dark:text-slate-400">
                      Tidak ada pasien
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. Patient Detail Drawer (Right-side Sheet) */}
      <Sheet open={!!activePatient} onOpenChange={(open) => !open && setActivePatient(null)}>
        <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0">
          {activePatient && (
            <div className="flex flex-col h-full">
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <PersonAvatar name={activePatient.name} className="h-12 w-12 ring-2 ring-primary/20" />
                    <div>
                      <SheetTitle className="text-lg font-bold text-foreground">
                        {activePatient.name}
                      </SheetTitle>
                      <SheetDescription className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span className="font-mono font-medium text-foreground">{activePatient.id}</span>
                        <span>·</span>
                        <span>{activePatient.gender === 'L' ? 'Laki-laki' : 'Perempuan'}, {activePatient.age} th</span>
                        <span>·</span>
                        <span>NIK: {activePatient.nik}</span>
                      </SheetDescription>
                    </div>
                  </div>
                </div>

                {/* Stage Progression Indicator Bar */}
                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      Tahap Saat Ini: {STAGES[activePatient.stage]}
                    </span>
                    <Badge className={cn('text-xs font-semibold px-2 py-0.5 border', STAGE_CONFIG[activePatient.stage].badgeClass)}>
                      {STAGE_CONFIG[activePatient.stage].shortLabel}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {STAGES.map((s, idx) => (
                      <div key={s} className="space-y-1">
                        <div
                          className={cn(
                            'h-2 rounded-full transition-all',
                            idx <= activePatient.stage ? STAGE_CONFIG[idx].colorDot : 'bg-slate-200 dark:bg-slate-800'
                          )}
                        />
                        <div className="text-[10px] text-muted-foreground truncate hidden sm:block">
                          {s}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Drawer Body Content */}
              <div className="p-6 space-y-6 flex-1">
                {/* Clinical Safety Disclaimer Box */}
                <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200 flex gap-2.5">
                  <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <span className="font-semibold">Protokol Keamanan Klinis TB:</span> Deteksi akustik batuk merupakan alat penapisan awal epidemiologis dan bukan diagnosis definitif TB. Diagnosis konfirmatif wajib melalui pemeriksaan bakteriologis (TCM GeneXpert / BTA) atau klinis oleh dokter spesialis paru.
                  </div>
                </div>

                {/* Context-sensitive Stage Transition Button */}
                {activePatient.stage < 4 && (
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-foreground" title="Naikkan tahap setelah evaluasi klinis">
                          Tindak Lanjut
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleOpenAdvanceDialog(activePatient)}
                        className="gap-1.5 text-xs font-medium"
                      >
                        <span>{STAGE_CONFIG[activePatient.stage].nextActionName}</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Patient Information Grid */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Informasi Pasien & Layanan
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                      <span className="text-muted-foreground">Fasilitas Pelayanan (Faskes)</span>
                      <div className="font-medium text-foreground mt-1 flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate">{activePatient.facility}</span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                      <span className="text-muted-foreground">Penanggung Jawab (PIC)</span>
                      <div className="font-medium text-foreground mt-1 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate">{activePatient.pic}</span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                      <span className="text-muted-foreground">Nomor Kontak / WhatsApp</span>
                      <div className="font-medium text-foreground mt-1">
                        {activePatient.phone || '–'}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                      <span className="text-muted-foreground">Lama Masa Pelacakan</span>
                      <div className="font-medium text-foreground mt-1">
                        H+{activePatient.daysIn}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Follow-up Scheduler Section */}
                <div className="rounded-lg border border-slate-200 bg-card p-4 shadow-2xs dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-foreground">
                        Jadwal Kontrol
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {activePatient.nextVisit
                          ? fmt.date(activePatient.nextVisit)
                          : 'Selesai'}
                      </p>
                    </div>
                    {activePatient.nextVisit && (
                      <Badge variant="outline" className="text-xs font-medium border-primary/30 text-primary">
                        {fmt.dayShort(activePatient.nextVisit)}
                      </Badge>
                    )}
                  </div>

                  {activePatient.stage < 4 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 items-center">
                      <span className="text-xs text-muted-foreground mr-1">Jadwalkan ulang:</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2.5"
                        onClick={() => handleReschedule(3)}
                      >
                        +3 Hari
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2.5"
                        onClick={() => handleReschedule(7)}
                      >
                        +1 Minggu
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2.5"
                        onClick={() => handleReschedule(14)}
                      >
                        +2 Minggu
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2.5"
                        onClick={() => handleReschedule(30)}
                      >
                        +1 Bulan
                      </Button>
                    </div>
                  )}
                </div>

                {/* Acoustic Initial Alert Link (jika terhubung deteksi) */}
                {activePatient.uuid && activePatient.uuid !== '—' && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-900/40 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Mic className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-foreground">
                          Sumber Deteksi Akustik Awal
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          UUID: {activePatient.uuid}
                        </div>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                      <Link href={`/detections/${activePatient.uuid}`}>
                        <span>Buka Rekaman</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                )}

                {/* Verified Service Timeline */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Linimasa Pelayanan & Audit Klinis
                    </h3>
                    <span className="text-[11px] text-muted-foreground">
                      {activePatient.events.length} catatan
                    </span>
                  </div>

                  <ol className="relative ml-2 space-y-4 border-l border-slate-200 pl-4 dark:border-slate-800">
                    {activePatient.events.map((ev, i) => (
                      <li key={i} className="relative">
                        <span
                          className={cn(
                            'absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-background',
                            STAGE_CONFIG[ev.stage]?.colorDot || 'bg-slate-400'
                          )}
                        />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            {STAGES[ev.stage] || 'Catatan Klinis'}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {fmt.dateTime(ev.t)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {ev.text}
                        </p>
                      </li>
                    ))}
                  </ol>

                  {/* Add Clinical Note Form */}
                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <Label htmlFor="logNote" className="text-xs font-semibold text-foreground">
                      Tambah Catatan Perkembangan Medis
                    </Label>
                    <div className="mt-1.5 flex gap-2">
                      <Input
                        id="logNote"
                        value={newLogNote}
                        onChange={(e) => setNewLogNote(e.target.value)}
                        placeholder="Tuliskan catatan pemeriksaan, hasil lab, atau keluhan pasien..."
                        className="text-xs h-9"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddLogNote();
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={handleAddLogNote}
                        disabled={!newLogNote.trim()}
                        className="h-9 px-3 text-xs shrink-0"
                      >
                        Simpan
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 6. Consequential Advance Stage Confirmation Dialog */}
      <Dialog open={!!advanceDialogPatient} onOpenChange={(open) => !open && setAdvanceDialogPatient(null)}>
        <DialogContent className="sm:max-w-md">
          {advanceDialogPatient && (
            <div>
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <ArrowRight className="h-5 w-5 text-primary" />
                  Naikkan Tahap
                </DialogTitle>
                <DialogDescription className="sr-only">Konfirmasi perubahan tahap pasien</DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-3.5 text-xs">
                {/* Patient Summary Preview */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="font-semibold text-foreground">{advanceDialogPatient.name}</div>
                  <div className="text-muted-foreground mt-0.5">
                    {advanceDialogPatient.id} · {advanceDialogPatient.facility}
                  </div>
                  <div className="mt-2 flex items-center gap-2 font-medium">
                    <Badge variant="outline" className="text-[11px]">
                      {STAGES[advanceDialogPatient.stage]}
                    </Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <Badge className={cn('text-[11px] text-white', STAGE_CONFIG[advanceDialogPatient.stage + 1]?.colorDot)}>
                      {STAGES[advanceDialogPatient.stage + 1]}
                    </Badge>
                  </div>
                </div>

                {/* Explicit Safety Notice */}
                <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-amber-900 text-[11px] dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200" title="Contoh: hasil TCM GeneXpert, rontgen dada, atau evaluasi dokter.">
                  Pastikan bukti verifikasi valid.
                </div>

                {/* Clinical Note Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="advNote" className="text-xs font-medium">
                    Catatan *
                  </Label>
                  <Input
                    id="advNote"
                    value={advanceNote}
                    onChange={(e) => setAdvanceNote(e.target.value)}
                    placeholder="Contoh: TCM GeneXpert MTB terdeteksi Rif Sensitif, mulai OAT..."
                    className="text-xs h-9"
                  />
                </div>
              </div>

              <DialogFooter className="mt-5 gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAdvanceDialogPatient(null)}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirmAdvance}
                  className="font-medium"
                >
                  Konfirmasi & Perbarui
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 7. Modal Pendaftaran Pasien Baru */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Pasien Baru
              </DialogTitle>
              <DialogDescription className="text-xs">Masuk tahap Terdeteksi.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3.5 sm:grid-cols-2 text-xs">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="pName">Nama Lengkap Pasien *</Label>
                <Input
                  id="pName"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nama sesuai KTP..."
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pNik">NIK (Nomor Induk Kependudukan)</Label>
                <Input
                  id="pNik"
                  value={form.nik}
                  onChange={(e) => setForm({ ...form, nik: e.target.value })}
                  placeholder="3578..."
                  maxLength={16}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Jenis Kelamin</Label>
                <RadioGroup
                  value={form.gender}
                  onValueChange={(v) => setForm({ ...form, gender: v as 'L' | 'P' })}
                  className="flex gap-4 pt-1"
                >
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                    <RadioGroupItem value="L" />
                    <span>Laki-laki</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                    <RadioGroupItem value="P" />
                    <span>Perempuan</span>
                  </label>
                </RadioGroup>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pAge">Umur (Tahun)</Label>
                <Input
                  id="pAge"
                  type="number"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  placeholder="Contoh: 35"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pPhone">No. Handphone / WhatsApp</Label>
                <Input
                  id="pPhone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="08..."
                  className="h-9 text-xs"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label>Faskes Rujukan Layanan</Label>
                <Select
                  value={form.facility}
                  onValueChange={(v) => setForm({ ...form, facility: v })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FACILITIES.filter((f) => f !== 'Semua Faskes').map((f) => (
                      <SelectItem key={f} value={f} className="text-xs">
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label>Tenaga Medis / Penanggung Jawab (PIC)</Label>
                <Select
                  value={form.pic}
                  onValueChange={(v) => setForm({ ...form, pic: v })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLINICIANS.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="pUuid">ID Deteksi Akustik (Opsional jika dari perangkat IoT / Mic)</Label>
                <Input
                  id="pUuid"
                  value={form.uuid}
                  onChange={(e) => setForm({ ...form, uuid: e.target.value })}
                  placeholder="Misal: mgqs60b3"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            {formError && (
              <p role="alert" className="text-xs font-medium text-rose-600">
                {formError}
              </p>
            )}

            <DialogFooter className="mt-4 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreating(false)}
              >
                Batal
              </Button>
              <Button type="submit" size="sm" className="font-medium">
                Daftarkan Pasien
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
