'use client';

import * as React from 'react';
import Link from 'next/link';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Logo } from './Logo';
import { SideMenu } from './SideMenu';
import { TopBar, type Crumb } from './TopBar';
import { AgentPanel } from '@/components/agent/AgentPanel';
import { useAgent } from '@/components/agent/AgentProvider';
import { cn } from '@/lib/utils';

export function useDarkMode() {
  const [dark, setDarkState] = React.useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- kelas dark baru diketahui setelah mount (SSR)
  React.useEffect(() => { setDarkState(document.documentElement.classList.contains('dark')); }, []);
  const setDark = React.useCallback((v: boolean) => {
    setDarkState(v);
    document.documentElement.classList.toggle('dark', v);
    try { localStorage.setItem('tbv_dark', v ? '1' : '0'); } catch { /* abaikan */ }
  }, []);
  return [dark, setDark] as const;
}

function Brand() {
  return (
    <Link href="/" className="flex items-center pt-5 pl-2 text-white transition hover:opacity-95">
      <Logo className="h-7 w-7 shrink-0" />
      <span className="ml-3 whitespace-nowrap text-lg font-bold tracking-wide">TB Guard</span>
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage baru bisa dibaca setelah mount (SSR)
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
  const agent = useAgent();
  // panel agen: kolom kanan di desktop, sheet di layar kecil
  const wide = useWide();
  const aw = useAgentWidth();

  return (
    <div className={cn('flex min-h-screen bg-shell', aw.dragging && 'cursor-col-resize select-none')}>
      {/* sidebar desktop: solid & rapi, tidak menutupi atau meng-overlap konten */}
      <aside className="relative hidden w-[240px] shrink-0 lg:block">
        <div className="sticky top-0 flex h-screen w-[240px] flex-col overflow-y-auto overflow-x-hidden bg-shell pb-8 pl-4 pr-0">
          <div className="pr-4"><Brand /></div>
          <div className="my-5 mr-4 h-px bg-white/10" />
          <div className="flex-1">
            <SideMenu />
          </div>
        </div>
      </aside>

      {/* menu ponsel */}
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left" className="w-[280px] border-0 bg-shell p-0 pl-5 text-white">
          <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
          <SheetDescription className="sr-only">Navigasi TB Guard</SheetDescription>
          <div className="pr-5"><Brand /></div>
          <div className="my-6 mr-5 h-px bg-white/10" />
          <SideMenu onNavigate={() => setMenu(false)} />
        </SheetContent>
      </Sheet>

      {/* panel konten */}
      <main className="relative min-h-screen min-w-0 flex-1 bg-page px-4 pb-10 md:px-6 lg:my-3 lg:mr-3 lg:min-h-[calc(100vh-24px)] lg:rounded-shell">
        <TopBar crumbs={crumbs} onMenu={() => setMenu(true)} dark={dark} onToggleDark={() => setDark(!dark)} />
        {children}
      </main>

      {/* panel agen (desktop) */}
      {wide && agent.open && (
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
      <Sheet open={!wide && agent.open} onOpenChange={agent.setOpen}>
        <SheetContent side="right" className="flex w-full flex-col overflow-hidden bg-page p-0 sm:max-w-md [&>button:last-child]:hidden">
          <SheetTitle className="sr-only">TB Guard Agent</SheetTitle>
          <SheetDescription className="sr-only">Chat agen untuk mengelola data TB Guard</SheetDescription>
          <AgentPanel className="h-full" onClose={() => agent.setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
