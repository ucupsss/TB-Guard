'use client';

import * as React from 'react';
import Link from 'next/link';
import { Moon } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Logo } from './Logo';
import { SideMenu } from './SideMenu';
import { TopBar, type Crumb } from './TopBar';

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
    <Link href="/" className="flex items-center pt-4 text-white">
      <Logo className="h-7 w-7" />
      <span className="ml-3 text-lg font-medium">TB Guard</span>
    </Link>
  );
}

export function AppLayout({ crumbs, children }: { crumbs: Crumb[]; children: React.ReactNode }) {
  const [menu, setMenu] = React.useState(false);
  const [dark, setDark] = useDarkMode();
  return (
    <div className="flex min-h-screen bg-shell">
      {/* sidebar */}
      <aside className="hidden w-[105px] shrink-0 pl-5 xl:w-[250px] lg:block">
        <div className="sticky top-0 max-h-screen overflow-y-auto overflow-x-hidden pb-10">
          <div className="pr-5"><Brand /></div>
          <div className="my-6 mr-5 h-px bg-white/[0.08]" />
          <SideMenu />
        </div>
      </aside>

      {/* menu ponsel */}
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left" className="w-[280px] border-0 bg-shell p-0 pl-5 text-white">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Navigasi TB Guard</SheetDescription>
          <div className="pr-5"><Brand /></div>
          <div className="my-6 mr-5 h-px bg-white/[0.08]" />
          <SideMenu onNavigate={() => setMenu(false)} />
        </SheetContent>
      </Sheet>

      {/* panel konten */}
      <main className="relative min-h-screen min-w-0 flex-1 bg-page px-4 pb-10 md:px-[22px] lg:my-3 lg:mr-3 lg:min-h-[calc(100vh-24px)] lg:rounded-shell">
        <TopBar crumbs={crumbs} onMenu={() => setMenu(true)} />
        {children}
      </main>

      {/* tombol mode gelap, melayang seperti template */}
      <label className="box fixed bottom-6 right-6 z-40 hidden h-12 cursor-pointer items-center gap-3 rounded-full border px-5 shadow-box-lg md:flex">
        <Moon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Dark Mode</span>
        <Switch checked={dark} onCheckedChange={setDark} aria-label="Mode gelap" />
      </label>
    </div>
  );
}
