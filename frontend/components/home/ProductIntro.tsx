'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightIcon, ChatBubbleIcon, MagicWandIcon, SpeakerLoudIcon, TargetIcon } from '@radix-ui/react-icons';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';

/* Tampil setiap kali beranda dibuka atau di-refresh. Penanda ini hidup di memori modul: reload penuh mengosongkannya,
   sedangkan kembali ke "/" lewat navigasi di dalam aplikasi tidak memunculkan jendela ini lagi. */
let shownThisLoad = false;

/* Nomor WhatsApp contoh (dummy) untuk demo; ganti dengan nomor resmi sebelum rilis. */
const WA_NUMBER = '6281234567890';
const WA_LINK = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Halo TB Guard, saya ingin tahu lebih lanjut tentang produk ini.')}`;

const POINTS = [
  { icon: SpeakerLoudIcon, label: 'Dengar batuk' },
  { icon: TargetIcon, label: 'Lacak sumber' },
  { icon: MagicWandIcon, label: 'Skrining AI' },
];

export function ProductIntro() {
  const router = useRouter();
  const { user } = useStore();
  const [open, setOpen] = React.useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- hanya tampil sekali per pemuatan halaman
  React.useEffect(() => { if (!shownThisLoad) { shownThisLoad = true; setOpen(true); } }, []);

  const go = (path: string) => { setOpen(false); router.push(path); };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden border-0 p-0 sm:rounded-2xl [&>button]:z-20 [&>button]:rounded-full [&>button]:bg-black/40 [&>button]:p-1.5 [&>button]:text-white [&>button]:opacity-100">
        <DialogTitle className="sr-only">TB Guard</DialogTitle>
        <DialogDescription className="sr-only">Video perangkat TB Guard, skrining TB dari suara batuk</DialogDescription>

        {/* video diputar otomatis tanpa kontrol */}
        <div className="relative bg-slate-950">
          <video className="pointer-events-none aspect-video w-full object-cover" src="/design-assets/videos/aura-assembly.mp4"
            autoPlay muted loop playsInline disablePictureInPicture controlsList="nodownload noplaybackrate nofullscreen" preload="auto"
            aria-label="Animasi perangkat TB Guard" />
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-5 pb-4 pt-16 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-tbguard.svg" alt="" className="h-11 w-11 rounded-xl bg-white/95 p-1.5" />
            <div>
              <div className="text-2xl font-semibold leading-none">TB Guard</div>
              <div className="mt-1 text-sm text-white/85">Batuk terdengar. TB terdeteksi.</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 px-5 pt-4">
          {POINTS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl bg-primary/5 py-3 text-center">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-white"><Icon className="h-4 w-4" /></span>
              <span className="text-xs font-medium text-foreground">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 pb-5 pt-4">
          <Button className="flex-1 sm:flex-none" onClick={() => go(user ? '/dashboard' : '/login')}>{user ? 'Buka Dashboard' : 'Masuk dengan Google'}<ArrowRightIcon /></Button>
          <Button variant="outline" onClick={() => setOpen(false)}>Lihat 3D</Button>
          <Button asChild variant="ghost" className="ml-auto text-[#128c4a] hover:text-[#128c4a]">
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" aria-label="Hubungi kami lewat WhatsApp"><ChatBubbleIcon />Hubungi kami</a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
