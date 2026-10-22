'use client';

import * as React from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { 
  Building2, 
  Train, 
  Landmark, 
  Wallet, 
  ShieldAlert, 
  FileText, 
  CheckCircle2, 
  ExternalLink,
  Info,
  Maximize
} from '@/components/ui/icons';

// Data 3 Pembayar: Dibuat padat, to-the-point, tanpa paragraf panjang
const STAKEHOLDERS = [
  {
    icon: Train,
    target: 'B2B · PT KAI & Operator Bandara / Terminal',
    budget: 'Anggaran K3 (HSE) & ESG BUMN',
    points: [
      'Mitigasi risiko klaster penularan di ruang tunggu ber-AC.',
      'Sertifikasi fasilitas transportasi publik sehat (ISO 45001).',
      'Mendongkrak skor ESG perusahaan penyedia transportasi massal.',
    ],
    model: 'Device-as-a-Service (DaaS): Rp4,5 Jt / node / bulan',
    roi: 'Cukup cegah 1 mutasi TB-RO per stasiun dalam 2,5 thn untuk titik impas.',
  },
  {
    icon: Landmark,
    target: 'B2G · Kementerian Kesehatan & Dinas Kesehatan',
    budget: 'DAK Fisik/Non-Fisik TBC & APBN Eliminasi 2030',
    points: [
      'Active Case Finding otomatis di simpul kerumunan tanpa beban nakes.',
      'Mencegah 1 pasien TB menulari 10–15 orang lain di ruang publik.',
      'Integrasi data surveilans real-time ke platform SatuSehat Kemenkes.',
    ],
    model: 'Lisensi Enterprise Surveillance SaaS per kabupaten / kota',
    roi: 'Mencegah 10 kasus TB biasa menghemat Rp1,36 Miliar biaya kuratif TB-RO.',
  },
  {
    icon: Building2,
    target: 'B2B · Rumah Sakit Swasta & Asuransi BPJS',
    budget: 'Anggaran PPI (Pencegahan Infeksi) & Lab Klinis',
    points: [
      'Cegah penularan nosokomial silang antara pasien batuk di ruang tunggu.',
      'Triase akustik AI menyaring sampel sebelum tes cepat molekuler (TCM).',
      'Menghemat cartridge GeneXpert mahal dari uji sampel negatif sia-sia.',
    ],
    model: 'Langganan software triase per poli klinik rawat jalan',
    roi: 'Efisiensi reagen lab & turunkan klaim komplikasi rawat inap paru.',
  },
];

// Bukti Dokumen & Screenshot
interface EvidenceDoc {
  id: string;
  code: string;
  title: string;
  source: string;
  keyTakeaway: string;
  imageSrc: string;
  pdfUrl?: string;
  altText: string;
  searchHint: string;
}

const EVIDENCE_DOCS: EvidenceDoc[] = [
  {
    id: 'perpres',
    code: 'Perpres No. 67 / 2021',
    title: 'Penanggulangan Tuberkulosis Nasional',
    source: 'Presiden Republik Indonesia',
    keyTakeaway: 'Pasal 6 & 13: Mewajibkan penemuan kasus aktif (Active Case Finding) di fasilitas umum padat & tempat khusus.',
    imageSrc: '/images/evidence/perpres-67-2021.png',
    pdfUrl: '/images/evidence/perpres-67-2021.pdf',
    altText: 'Screenshot Dokumen Perpres No 67 Tahun 2021 Pasal 6 dan 13',
    searchHint: 'Screenshot halaman Perpres 67/2021 (Pasal 6 ayat 2 atau Pasal 13 penemuan aktif di tempat umum)',
  },
  {
    id: 'biaya',
    code: 'Renaksi Kemenkes RI',
    title: 'Beban Biaya Perawatan TBC vs TB-RO',
    source: 'Kementerian Kesehatan Republik Indonesia',
    keyTakeaway: 'TB biasa: Rp4–7 Jt vs TB Resisten Obat (TB-RO): Rp136,31 Jt per pasien bila terlambat terdeteksi.',
    imageSrc: '/images/evidence/biaya-tbro-kemenkes.png',
    pdfUrl: '/images/evidence/renaksi-tbc.pdf',
    altText: 'Screenshot Tabel Biaya TB Resisten Obat Renaksi Kemenkes',
    searchHint: 'Screenshot tabel Renaksi Kemenkes perbandingan biaya TB biasa vs TB-RO Rp136 Juta',
  },
  {
    id: 'who',
    code: 'WHO Global Report',
    title: 'Indonesia Peringkat 2 Kasus TB Dunia',
    source: 'World Health Organization (WHO 2023)',
    keyTakeaway: 'Estimasi 1,06–1,09 juta kasus baru/tahun. Kemenkes menargetkan 90% penemuan kasus untuk eliminasi 2030.',
    imageSrc: '/images/evidence/who-tb-report.png',
    pdfUrl: '/images/evidence/global-tb-report-2023.pdf',
    altText: 'Screenshot Peringkat Beban TB Global WHO Report 2023',
    searchHint: 'Screenshot tabel High TB Burden Countries WHO Report (India 1, Indonesia 2)',
  },
  {
    id: 'iso',
    code: 'ISO 45001 & Permenaker',
    title: 'Standar K3 & Lingkungan Transportasi Sehat',
    source: 'Kemenaker RI & Komitmen ESG PT KAI',
    keyTakeaway: 'Pengendalian bahaya biologi (droplet/airborne) pada sirkulasi tertutup fasilitas publik & stasiun kereta api.',
    imageSrc: '/images/evidence/kai-k3-esg.png',
    pdfUrl: '/images/evidence/kai-sustainability-report.pdf',
    altText: 'Screenshot Laporan K3 dan ESG Pengendalian Udara Stasiun PT KAI',
    searchHint: 'Screenshot laporan keberlanjutan / komitmen K3 ISO 45001 fasilitas stasiun PT KAI',
  },
];

export default function BusinessPotential() {
  const [activeModal, setActiveModal] = React.useState<EvidenceDoc | null>(null);

  return (
    <AppLayout crumbs={[{ label: 'Peluang Pasar', to: '/market' }, { label: 'Potensi Bisnis' }]}>
      {/* Header Ringkas */}
      <div className="intro-y mb-6 mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Kelayakan Komersial</Badge>
            <Badge variant="outline">Perpres 67/2021</Badge>
            <Badge variant="outline">Kemenkes &amp; PT KAI</Badge>
          </div>
          <h1 className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">
            Potensi Bisnis &amp; Bukti Regulasi
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Siapa yang membayar, insentif finansial penghematan biaya, dan bukti otentik dasar hukum pemerintah.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/market">
            Buka Kalkulator Penghematan ↗
          </Link>
        </Button>
      </div>

      {/* 4 Angka Kunci Finansial */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="box intro-y flex items-center gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <div className="text-lg font-bold text-foreground sm:text-xl">Rp136 Jt</div>
            <div className="text-[11px] text-muted-foreground">Biaya per kasus TB-RO</div>
          </div>
        </div>
        <div className="box intro-y flex items-center gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Train className="h-5 w-5" />
          </span>
          <div>
            <div className="text-lg font-bold text-foreground sm:text-xl">Rp4,5 Jt</div>
            <div className="text-[11px] text-muted-foreground">DaaS / node / bulan</div>
          </div>
        </div>
        <div className="box intro-y flex items-center gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <div className="text-lg font-bold text-foreground sm:text-xl">2,5 Thn</div>
            <div className="text-[11px] text-muted-foreground">Titik impas per stasiun</div>
          </div>
        </div>
        <div className="box intro-y flex items-center gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
            <Landmark className="h-5 w-5" />
          </span>
          <div>
            <div className="text-lg font-bold text-foreground sm:text-xl">1,09 Jt</div>
            <div className="text-[11px] text-muted-foreground">Kasus TB baru / tahun</div>
          </div>
        </div>
      </div>

      {/* Bagian 1: Siapa yang Membayar (3 Kolom Ringkas) */}
      <div className="mt-7">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-foreground sm:text-base">
            Siapa yang Membayar? (B2B &amp; B2G Stakeholders)
          </h2>
          <p className="text-xs text-muted-foreground">
            Masyarakat di stasiun menikmati layanan secara gratis. Pembiayaan ditanggung oleh 3 pihak:
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {STAKEHOLDERS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.target} className="box intro-y flex flex-col justify-between p-4 sm:p-5">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <h3 className="text-xs font-semibold text-foreground sm:text-sm">{s.target}</h3>
                  </div>

                  <div className="mt-3 rounded bg-slate-50 px-2.5 py-1.5 text-[11px] text-muted-foreground dark:bg-white/5">
                    <span className="font-semibold text-foreground">Sumber Dana: </span>{s.budget}
                  </div>

                  <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    {s.points.map((pt, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary dark:text-blue-400" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 border-t border-slate-200/60 pt-3 text-[11px] dark:border-white/10">
                  <div className="font-semibold text-primary dark:text-blue-400">{s.model}</div>
                  <div className="mt-1 text-muted-foreground"><b className="text-foreground">ROI: </b>{s.roi}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bagian 2: Galeri Bukti Dokumen & Screenshot Regulasi (Visual untuk Juri) */}
      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground sm:text-base">
              Bukti Dokumen Regulasi &amp; Data Resmi Pemerintah
            </h2>
            <p className="text-xs text-muted-foreground">
              Tangkapan layar lembar regulasi negara dan data resmi Kemenkes/WHO yang membuktikan landasan TB Guard.
            </p>
          </div>
          <Badge variant="outline" className="text-[11px]">
            Klik kartu untuk memperbesar
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EVIDENCE_DOCS.map((doc) => (
            <div 
              key={doc.id}
              onClick={() => setActiveModal(doc)}
              className="box intro-y group cursor-pointer overflow-hidden p-0 transition-all hover:border-primary/50 hover:shadow-md"
            >
              {/* Gambar / Slot Screenshot */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
                <img 
                  src={doc.imageSrc} 
                  alt={doc.altText}
                  onError={(e) => {
                    // Fallback jika file gambar screenshot belum ditaruh di public/images/evidence/
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    if (target.nextElementSibling) {
                      (target.nextElementSibling as HTMLElement).style.display = 'flex';
                    }
                  }}
                  className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                />
                
                {/* Fallback frame placeholder */}
                <div style={{ display: 'none' }} className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
                  <FileText className="h-8 w-8 text-primary/60" />
                  <span className="mt-2 text-xs font-semibold text-foreground">{doc.code}</span>
                  <span className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{doc.searchHint}</span>
                  <Badge variant="outline" className="mt-2 text-[9px]">Taruh SS di: {doc.imageSrc}</Badge>
                </div>

                <div className="absolute right-2 top-2 rounded bg-black/60 p-1 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                  <Maximize className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Teks Keterangan Ringkas */}
              <div className="p-3.5">
                <Badge variant="outline" className="font-mono text-[10px]">{doc.code}</Badge>
                <h3 className="mt-1.5 text-xs font-semibold text-foreground line-clamp-1">{doc.title}</h3>
                <div className="text-[11px] text-muted-foreground">{doc.source}</div>
                <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground line-clamp-2">
                  {doc.keyTakeaway}
                </p>
                <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-white/5">
                  <span className="text-[10px] font-medium text-primary dark:text-blue-400">Klik untuk perbesar</span>
                  {doc.pdfUrl && (
                    <a 
                      href={doc.pdfUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-primary hover:text-white dark:bg-white/10 dark:text-slate-300"
                    >
                      <FileText className="h-3 w-3" /> PDF Resmi
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>


      {/* Modal Lightbox untuk Memperbesar Screenshot */}
      <Dialog open={!!activeModal} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-3xl overflow-hidden p-0">
          {activeModal && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
                <div>
                  <DialogTitle className="text-base font-semibold">{activeModal.title}</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    {activeModal.code} · Sumber: {activeModal.source}
                  </DialogDescription>
                </div>
                {activeModal.pdfUrl && (
                  <Button asChild size="sm" variant="default" className="gap-1.5 mr-6">
                    <a href={activeModal.pdfUrl} target="_blank" rel="noopener noreferrer">
                      <FileText className="h-3.5 w-3.5" /> Buka Dokumen PDF Resmi ↗
                    </a>
                  </Button>
                )}
              </div>
              <div className="relative max-h-[65vh] overflow-y-auto bg-slate-950 p-2">
                <img 
                  src={activeModal.imageSrc} 
                  alt={activeModal.altText}
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    if (target.nextElementSibling) {
                      (target.nextElementSibling as HTMLElement).style.display = 'block';
                    }
                  }}
                  className="mx-auto w-full max-w-2xl rounded object-contain shadow-lg"
                />
                <div style={{ display: 'none' }} className="rounded-lg border border-dashed border-white/20 p-8 text-center text-white">
                  <FileText className="mx-auto h-12 w-12 text-primary" />
                  <p className="mt-3 text-sm font-semibold">File Gambar Screenshot Belum Diletakkan</p>
                  <p className="mt-1 text-xs text-white/70">
                    Simpan tangkapan layar dokumen PDF resmi ke:
                  </p>
                  <code className="mt-2 inline-block rounded bg-white/10 px-2 py-1 text-xs font-mono text-emerald-400">
                    frontend/public{activeModal.imageSrc}
                  </code>
                  <p className="mt-3 text-xs text-white/60">
                    Panduan SS: {activeModal.searchHint}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 text-xs text-muted-foreground dark:bg-white/5">
                <div>
                  <span className="font-semibold text-foreground">Kutipan Pasal / Data Inti: </span>
                  {activeModal.keyTakeaway}
                </div>
                {activeModal.pdfUrl && (
                  <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                    <a href={activeModal.pdfUrl} target="_blank" rel="noopener noreferrer">
                      Unduh PDF ↗
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
