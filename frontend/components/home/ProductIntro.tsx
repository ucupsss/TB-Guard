'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SpeakerLoudIcon, SpeakerOffIcon } from '@radix-ui/react-icons';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';

/* Nomor WhatsApp contoh (dummy) untuk demo; ganti dengan nomor resmi sebelum rilis. */
const WA_NUMBER = '6281234567890';
const WA_LINK = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Halo TB Guard, saya ingin tahu lebih lanjut tentang produk ini.')}`;


export function ProductIntro() {
  const router = useRouter();
  const { user } = useStore();
  const [open, setOpen] = React.useState(false);
  const [muted, setMuted] = React.useState(true);
  const [tap, setTap] = React.useState(false); // browser menolak suara otomatis: tampilkan ajakan untuk menyalakan
  const vid = React.useRef<HTMLVideoElement | null>(null);
  // tampil SETIAP kali beranda dibuka: pertama kali, refresh, atau kembali ke beranda lewat tombol/menu
  // (komponen ini dipasang ulang setiap kali halaman "/" dimasuki)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- membuka popup saat halaman dimasuki
  React.useEffect(() => { setOpen(true); }, []);

  /** coba putar DENGAN suara (diizinkan bila pengguna sudah berinteraksi dengan halaman); jika ditolak, putar senyap dan ajak menyalakan suara */
  const attach = React.useCallback((el: HTMLVideoElement | null) => {
    vid.current = el;
    if (!el || el.dataset.started) return;
    el.dataset.started = '1';
    el.volume = 0.7;
    el.muted = false;
    el.play().then(() => { setMuted(false); setTap(false); }).catch(() => {
      el.muted = true; setMuted(true); setTap(true);
      void el.play().catch(() => { /* autoplay sepenuhnya diblokir */ });
    });
  }, []);
  const toggleSound = () => {
    const el = vid.current;
    if (!el) return;
    el.muted = !el.muted;
    if (!el.muted) { el.volume = 0.7; void el.play().catch(() => {}); }
    setMuted(el.muted); setTap(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden border-0 p-0 sm:rounded-2xl [&>button]:z-20 [&>button]:rounded-full [&>button]:bg-black/40 [&>button]:p-1.5 [&>button]:text-white [&>button]:opacity-100">
        <DialogTitle className="sr-only">TB Guard</DialogTitle>
        <DialogDescription className="sr-only">Video perangkat TB Guard, skrining TB dari suara batuk</DialogDescription>

        {/* video diputar otomatis tanpa kontrol */}
        <div className="relative bg-slate-950">
          <video ref={attach} className="aspect-video w-full cursor-pointer object-cover" src="/design-assets/videos/aura-assembly.mp4"
            loop playsInline disablePictureInPicture controlsList="nodownload noplaybackrate nofullscreen" preload="auto"
            onClick={toggleSound} aria-label="Animasi perangkat TB Guard" />
          <button type="button" onClick={toggleSound} aria-pressed={!muted} aria-label={muted ? 'Nyalakan suara' : 'Matikan suara'}
            className="absolute right-3 top-3 z-10 mr-11 flex items-center gap-1.5 rounded-full bg-black/55 py-1.5 pl-2.5 pr-3 text-xs font-medium text-white backdrop-blur transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            {muted ? <SpeakerOffIcon className="h-4 w-4" /> : <SpeakerLoudIcon className="h-4 w-4" />}
            {muted ? (tap ? 'Ketuk untuk suara' : 'Suara mati') : 'Suara menyala'}
          </button>
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-5 pb-4 pt-16 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-tbguard.svg" alt="" className="h-11 w-11 rounded-xl bg-white/95 p-1.5" />
            <div>
              <div className="text-2xl font-semibold leading-none">TBGuard-Agent</div>
              <div className="mt-1 text-sm text-white/85">Batuk terdengar. TB terdeteksi.</div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-5 pb-5 pt-4">
          Tertarik dengan produk TBguard-Agent? <br />Hubungi kami melalui WhatsApp
          <Button asChild variant="ghost" className="ml-auto text-[#128c4a] hover:text-[#128c4a] gap-2">
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" aria-label="Hubungi kami lewat WhatsApp">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/WhatsApp.svg.webp" alt="WhatsApp" className="h-4 w-4 object-contain inline-block" />
              Hubungi kami
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
