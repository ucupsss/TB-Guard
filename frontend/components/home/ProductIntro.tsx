'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightIcon, BarChartIcon, CameraIcon, ChatBubbleIcon, CheckCircledIcon, CubeIcon, MagicWandIcon, SpeakerLoudIcon, TargetIcon } from '@radix-ui/react-icons';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/lib/store';

/* Tampil setiap kali beranda dibuka atau di-refresh. Penanda ini hidup di memori modul: reload penuh mengosongkannya,
   sedangkan kembali ke "/" lewat navigasi di dalam aplikasi tidak memunculkan jendela ini lagi. */
let shownThisLoad = false;

/* Nomor WhatsApp contoh (dummy) untuk demo; ganti dengan nomor resmi sebelum rilis. */
const WA_NUMBER = '6281234567890';
const WA_DISPLAY = '+62 812-3456-7890';
const WA_LINK = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Halo TB Guard, saya ingin tahu lebih lanjut tentang produk ini.')}`;

const FEATURES = [
  { icon: SpeakerLoudIcon, title: 'Dengar batuk', text: 'Mic array 4–6 kanal menangkap batuk di keramaian.' },
  { icon: TargetIcon, title: 'Tahu siapa & di mana', text: 'Arah suara (DOA) + kamera melacak sumber batuk.' },
  { icon: MagicWandIcon, title: 'AI skrining TB', text: 'CWT + MobileNetV3 menilai risiko dari pola akustik.' },
  { icon: BarChartIcon, title: 'Tindak lanjut', text: 'Dashboard, pelacakan pasien, dan agen AI untuk petugas.' },
];

const STEPS = [
  { n: '1', title: 'Dengar', text: 'Sensor di ruang tunggu mendeteksi peristiwa batuk 16 kHz.' },
  { n: '2', title: 'Lokalisasi', text: 'TDOA menentukan arah; kamera menyorot orangnya.' },
  { n: '3', title: 'Klasifikasi', text: 'Model menilai pola batuk terindikasi TB atau bukan.' },
  { n: '4', title: 'Rujuk', text: 'Petugas meninjau lalu merujuk ke TCM/GeneXpert.' },
];

const METRICS = [
  { value: '93,1%', label: 'Akurasi' },
  { value: '92,6%', label: 'Sensitivitas' },
  { value: '93,5%', label: 'Spesifisitas' },
  { value: '0,968', label: 'ROC-AUC' },
];

export function ProductIntro() {
  const router = useRouter();
  const { user, devices, detections } = useStore();
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState('demo');
  // eslint-disable-next-line react-hooks/set-state-in-effect -- hanya tampil sekali per pemuatan halaman
  React.useEffect(() => { if (!shownThisLoad) { shownThisLoad = true; setOpen(true); } }, []);

  const active = devices.filter((d) => d.status === 'active').length;
  const tb = detections.filter((d) => d.result === 'TB' && !d.reviewed).length;
  const go = (path: string) => { setOpen(false); router.push(path); };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0 sm:rounded-2xl [&>button]:z-10 [&>button]:text-white">
        <DialogTitle className="sr-only">Produk TB Guard</DialogTitle>
        <DialogDescription className="sr-only">Ringkasan produk TB Guard: fitur, cara kerja, dan hasil evaluasi model</DialogDescription>

        <div className="bg-gradient-to-br from-primary to-[#12288f] px-6 pb-5 pt-6 text-white">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-tbguard.svg" alt="" className="h-12 w-12 rounded-xl bg-white/95 p-1.5" />
            <div>
              <div className="text-2xl font-semibold leading-tight">TB Guard</div>
              <div className="text-sm text-white/80">Skrining TB dari suara batuk di ruang publik</div>
            </div>
            <Badge className="ml-auto border-white/30 bg-white/15 text-white hover:bg-white/15">Prototipe produk</Badge>
          </div>
          {user && (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/15 px-3 py-1">{active} perangkat aktif</span>
              <span className="rounded-full bg-white/15 px-3 py-1">{tb} batuk TB menunggu ditinjau</span>
            </div>
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab} className="px-6 pb-2 pt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="demo">Demo</TabsTrigger>
            <TabsTrigger value="produk">Produk</TabsTrigger>
            <TabsTrigger value="cara">Cara kerja</TabsTrigger>
            <TabsTrigger value="hasil">Hasil</TabsTrigger>
          </TabsList>

          <TabsContent value="demo" className="mt-4">
            {/* rekaman animasi perakitan perangkat; hanya dimuat saat tab Demo tampil */}
            <div className="relative overflow-hidden rounded-xl border bg-slate-950">
              <video className="aspect-video w-full object-cover" src="/design-assets/videos/aura-assembly.mp4" autoPlay muted loop playsInline controls preload="metadata" aria-label="Animasi perakitan perangkat TB Guard" />
              <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white backdrop-blur">Perangkat TB Guard · ESP32-S3 + mic array</span>
            </div>
            <p className="mt-2.5 text-xs text-muted-foreground">Lihat bagaimana sensor dirakit: papan ESP32-S3, mikrofon INMP441, dan carrier dalam satu modul siap pasang.</p>
          </TabsContent>

          <TabsContent value="produk" className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex gap-3 rounded-xl border p-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
                  <div><div className="text-sm font-medium text-foreground">{title}</div><div className="text-xs text-muted-foreground">{text}</div></div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <CubeIcon className="h-3.5 w-3.5" />ESP32-S3 · INMP441 mic array · kamera · berjalan di tepi (edge)
            </div>
          </TabsContent>

          <TabsContent value="cara" className="mt-4">
            <ol className="grid gap-2.5 sm:grid-cols-2">
              {STEPS.map((s) => (
                <li key={s.n} className="flex gap-3 rounded-xl border p-3.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-white">{s.n}</span>
                  <div><div className="text-sm font-medium text-foreground">{s.title}</div><div className="text-xs text-muted-foreground">{s.text}</div></div>
                </li>
              ))}
            </ol>
          </TabsContent>

          <TabsContent value="hasil" className="mt-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {METRICS.map((m) => (
                <div key={m.label} className="rounded-xl bg-primary/5 p-3.5 text-center">
                  <div className="text-xl font-semibold text-primary">{m.value}</div>
                  <div className="text-xs text-muted-foreground">{m.label}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 flex gap-1.5 text-[11px] leading-snug text-muted-foreground">
              <CheckCircledIcon className="mt-0.5 h-3 w-3 shrink-0" />
              Uji held-out 420 sampel batuk klinis. Alat skrining untuk memprioritaskan pemeriksaan TCM/GeneXpert, bukan diagnosis.
            </p>
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap items-center gap-3 border-t bg-slate-50 px-6 py-3 dark:bg-white/5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#25D366] text-white"><ChatBubbleIcon className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground">Hubungi kami lebih lanjut</div>
            <div className="text-xs text-muted-foreground">WhatsApp {WA_DISPLAY} · demo, bukan nomor asli</div>
          </div>
          <Button asChild size="sm" className="bg-[#25D366] text-white hover:bg-[#1fb857]">
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer">Chat WhatsApp<ArrowRightIcon /></a>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={() => setOpen(false)}><CameraIcon />Lihat simulasi 3D</Button>
          <Button variant="ghost" onClick={() => go('/market')} className={user ? '' : 'hidden'}><BarChartIcon />Peluang pasar</Button>
          <Button className="ml-auto" onClick={() => go(user ? '/dashboard' : '/login')}>{user ? 'Buka Dashboard' : 'Masuk dengan Google'}<ArrowRightIcon /></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
