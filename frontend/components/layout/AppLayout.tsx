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
  // eslint-disable-next-line react-hooks/set-state-in-effect -- kelas dark baru diketahui setelah mount (SSR)
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
    <Link href="/" className={cn('flex items-center pt-4 text-white', rail && 'pl-4')}>
      <Logo className="h-7 w-7 shrink-0" />
      <span className={cn('ml-3 whitespace-nowrap text-lg font-medium', rail && 'side-label')}>TB Guard</span>
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
      {/* sidebar: rel ikon saja, melebar saat di-hover (atau difokus keyboard) menimpa konten */}
      <aside className="group/side relative hidden w-[84px] shrink-0 lg:block">
        <div className="fixed inset-y-0 left-0 z-50 w-[84px] overflow-y-auto overflow-x-hidden bg-shell pb-10 pl-5 transition-[width,box-shadow] duration-200 ease-out group-hover/side:w-[250px] group-hover/side:shadow-2xl group-focus-within/side:w-[250px]">
          <div className="pr-5"><Brand rail /></div>
          <div className="my-6 mr-5 h-px bg-white/[0.08]" />
          <SideMenu rail />
        </div>
      </aside>

      {/* menu ponsel */}
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left" className="flex flex-col w-[280px] border-0 bg-shell p-0 pl-5 text-white">
          <SheetTitle className="sr-only">Menu</SheetTitle>
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
        <TopBar crumbs={crumbs} onMenu={() => setMenu(true)} />
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

      {/* tombol mode gelap, melayang seperti template */}
      <label style={wide && agent.open ? { right: aw.w + 24 } : undefined} className="box fixed bottom-6 right-6 z-40 hidden h-12 cursor-pointer items-center gap-3 rounded-full border px-5 shadow-box-lg md:flex">
        <MoonIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Dark Mode</span>
        <Switch checked={dark} onCheckedChange={setDark} aria-label="Mode gelap" />
      </label>
    </div>
  );
}
