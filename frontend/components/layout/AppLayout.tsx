'use client';

import * as React from 'react';
import Link from 'next/link';
import { MoonIcon } from '@radix-ui/react-icons';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Logo } from './Logo';
import { SideMenu } from './SideMenu';
import { TopBar, type Crumb } from './TopBar';
import { AgentPanel } from '@/components/agent/AgentPanel';
import { useAgent } from '@/components/agent/AgentProvider';
import { cn } from '@/lib/utils';

export function useDarkMode() {
  const [dark, setDarkState] = React.useState(false);
  React.useEffect(() => { setDarkState(document.documentElement.classList.contains('dark')); }, []);
  const setDark = React.useCallback((v: boolean) => {
    setDarkState(v);
    document.documentElement.classList.toggle('dark', v);
    try { localStorage.setItem('tbv_dark', v ? '1' : '0'); } catch { /* abaikan */ }
  }, []);
  return [dark, setDark] as const;
}

function Brand({ rail }: { rail?: boolean }) {
  return (
    <Link
      href="/"
      className={cn(
        'flex items-center pt-4 text-white transition-all',
        rail ? 'pl-2.5 lg:pl-3' : 'pl-0'
      )}
      title="TB Guard"
    >
      <Logo className="h-10 w-10 sm:h-11 sm:w-11 lg:h-12 lg:w-12 shrink-0 drop-shadow-sm transition-transform duration-200 group-hover/side:scale-105" />
      <span
        className={cn(
          'ml-3.5 whitespace-nowrap text-xl lg:text-2xl font-bold tracking-tight',
          rail && 'side-label'
        )}
      >
        TB Guard
      </span>
    </Link>
  );
}

const WIDE = '(min-width: 1024px)';
const subscribeWide = (cb: () => void) => { const mq = window.matchMedia(WIDE); mq.addEventListener('change', cb); return () => mq.removeEventListener('change', cb); };
/** true di layar lg ke atas (false saat SSR) */
const useWide = () => React.useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false);

const AGENT_W_KEY = 'tbv_agent_w';
const AGENT_MIN = 320;
const agentMax = () => Math.max(AGENT_MIN, Math.min(900, window.innerWidth - 480));

/** lebar panel agen yang bisa digeser dari tepi kirinya; disimpan per browser */
function useAgentWidth() {
  const [w, setW] = React.useState(400);
  const [dragging, setDragging] = React.useState(false);
  React.useEffect(() => {
    try { const v = Number(localStorage.getItem(AGENT_W_KEY)); if (v) setW(Math.min(Math.max(v, AGENT_MIN), agentMax())); } catch { /* abaikan */ }
  }, []);
  const save = (v: number) => { try { localStorage.setItem(AGENT_W_KEY, String(Math.round(v))); } catch { /* abaikan */ } };
  const clamp = (v: number) => Math.min(Math.max(v, AGENT_MIN), agentMax());

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const x0 = e.clientX, w0 = w;
    let last = w0;
    setDragging(true);
    const move = (ev: PointerEvent) => { last = clamp(w0 + x0 - ev.clientX); setW(last); };
    const up = () => { setDragging(false); save(last); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowLeft' ? 24 : e.key === 'ArrowRight' ? -24 : 0;
    if (!d) return;
    e.preventDefault();
    const v = clamp(w + d); setW(v); save(v);
  };
  const reset = () => { setW(400); save(400); };
  return { w, dragging, onPointerDown, onKeyDown, reset };
}

export function AppLayout({ crumbs, children }: { crumbs: Crumb[]; children: React.ReactNode }) {
  const [menu, setMenu] = React.useState(false);
  const [dark, setDark] = useDarkMode();
  const [mounted, setMounted] = React.useState(false);
  const agent = useAgent();
  // panel agen: kolom kanan di desktop, sheet di layar kecil
  const wide = useWide();
  const aw = useAgentWidth();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={cn('flex min-h-screen bg-shell', aw.dragging && 'cursor-col-resize select-none')} suppressHydrationWarning>
      {/* sidebar desktop: rel ikon kecil (84px), baru muncul teks saat di-hover (250px) */}
      <aside className="group/side relative hidden w-[84px] shrink-0 lg:block">
        <div className="sidebar-rail fixed inset-y-0 left-0 z-50 overflow-y-auto overflow-x-hidden bg-shell pb-10 pl-5">
          <div className="pr-5"><Brand rail /></div>
          <div className="my-6 mr-5 h-px bg-white/[0.08]" />
          <SideMenu rail />
        </div>
      </aside>

      {/* menu ponsel */}
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left" className="flex flex-col w-[280px] border-0 bg-shell p-0 pl-5 text-white">
          <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
          <SheetDescription className="sr-only">Navigasi TB Guard</SheetDescription>
          <div className="pr-5"><Brand /></div>
          <div className="my-6 mr-5 h-px bg-white/[0.08]" />
          <div className="flex-1 overflow-y-auto">
            <SideMenu onNavigate={() => setMenu(false)} />
          </div>
          <div className="my-4 mr-5 border-t border-white/10 pt-4 pb-6 flex items-center justify-between pr-4">
            <span className="flex items-center gap-2 text-sm text-white/80">
              <MoonIcon className="h-4 w-4" /> Mode Gelap
            </span>
            <Switch checked={dark} onCheckedChange={setDark} aria-label="Mode gelap" />
          </div>
        </SheetContent>
      </Sheet>

      {/* panel konten */}
      <main className="relative min-h-screen min-w-0 flex-1 bg-page px-4 pb-10 md:px-[22px] lg:my-3 lg:mr-3 lg:min-h-[calc(100vh-24px)] lg:rounded-shell">
        <TopBar crumbs={crumbs} onMenu={() => setMenu(true)} dark={dark} onToggleDark={() => setDark(!dark)} />
        {children}
      </main>

      {/* panel agen (desktop) */}
      {mounted && wide && agent.open && (
        <aside aria-label="TB Guard Agent" style={{ width: aw.w }} className="sticky top-3 my-3 mr-3 h-[calc(100vh-24px)] shrink-0 rounded-shell bg-page">
          {/* pegangan geser lebar; klik ganda untuk kembali ke lebar awal */}
          <div role="separator" aria-orientation="vertical" aria-label="Ubah lebar panel agen" aria-valuenow={aw.w} tabIndex={0}
            onPointerDown={aw.onPointerDown} onKeyDown={aw.onKeyDown} onDoubleClick={aw.reset} title="Geser untuk mengubah lebar"
            className="group/rs absolute inset-y-0 -left-3 z-10 flex w-3 cursor-col-resize touch-none justify-center outline-none">
            <span className={cn('my-4 w-[3px] rounded-full transition-colors group-hover/rs:bg-primary/60 group-focus-visible/rs:bg-primary', aw.dragging && 'bg-primary')} />
          </div>
          <div className="h-full overflow-hidden rounded-shell">
            <AgentPanel className="h-full" onClose={() => agent.setOpen(false)} />
          </div>
        </aside>
      )}
      {/* panel agen (ponsel / tablet) */}
      {mounted && !wide && (
        <Sheet open={agent.open} onOpenChange={agent.setOpen}>
          <SheetContent side="right" className="flex w-full flex-col overflow-hidden bg-page p-0 sm:max-w-md [&>button:last-child]:hidden">
            <SheetTitle className="sr-only">TB Guard Agent</SheetTitle>
            <SheetDescription className="sr-only">Chat agen untuk mengelola data TB Guard</SheetDescription>
            <AgentPanel className="h-full" onClose={() => agent.setOpen(false)} />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
