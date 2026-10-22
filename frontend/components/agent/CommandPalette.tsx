'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRightIcon, ExternalLinkIcon, MagicWandIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { NAV } from '@/components/layout/nav';
import { cn } from '@/lib/utils';
import { QUICK_PROMPTS, pageLabel, suggestions } from '@/lib/agent/suggest';
import { useAgent } from './AgentProvider';

interface Item { id: string; group: string; label: string; hint?: string; icon: 'agent' | 'page'; run: () => void }

const PAGES = NAV.flatMap((n) => (n === 'divider' ? [] : n.children ? n.children.map((c) => ({ label: c.label, to: c.to })) : n.to ? [{ label: n.label, to: n.to }] : []));

/** Palet perintah (Ctrl+K): ketik apa saja lalu Enter untuk bertanya ke agen dari halaman mana pun, atau lompat ke halaman. */
export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, ask, running } = useAgent();
  const router = useRouter();
  const path = usePathname() || '/';
  const [q, setQ] = React.useState('');
  const [idx, setIdx] = React.useState(0);

  const close = () => { setPaletteOpen(false); setQ(''); setIdx(0); };
  const items = React.useMemo<Item[]>(() => {
    const query = q.trim().toLowerCase();
    const list: Item[] = [];
    const go = (prompt: string) => () => { close(); ask(prompt); };
    if (q.trim()) list.push({ id: 'ask', group: 'Agen', label: `Tanya agen: “${q.trim()}”`, hint: 'Enter', icon: 'agent', run: go(q.trim()) });
    const prompts = [...suggestions(path).map((s) => ({ label: s, prompt: s })), ...QUICK_PROMPTS].filter((p, i, a) => a.findIndex((x) => x.prompt === p.prompt) === i);
    prompts.filter((p) => !query || p.label.toLowerCase().includes(query)).slice(0, query ? 4 : 5)
      .forEach((p) => list.push({ id: 'p:' + p.prompt, group: query ? 'Saran agen' : `Saran untuk ${pageLabel(path)}`, label: p.label, icon: 'agent', run: go(p.prompt) }));
    PAGES.filter((p) => !query || p.label.toLowerCase().includes(query)).slice(0, query ? 5 : 6)
      .forEach((p) => list.push({ id: 'n:' + p.to, group: 'Buka halaman', label: p.label, hint: p.to, icon: 'page', run: () => { close(); router.push(p.to); } }));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close/ask/router stabil untuk keperluan daftar ini
  }, [q, path]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => (i + 1) % Math.max(items.length, 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => (i - 1 + items.length) % Math.max(items.length, 1)); }
    else if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); items[Math.min(idx, items.length - 1)]?.run(); }
  };

  let lastGroup = '';
  return (
    <Dialog open={paletteOpen} onOpenChange={(o) => (o ? setPaletteOpen(true) : close())}>
      <DialogContent className="top-[18%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0 sm:rounded-xl" onOpenAutoFocus={(e) => { e.preventDefault(); document.getElementById('cmdk-input')?.focus(); }}>
        <DialogTitle className="sr-only">Palet perintah agen</DialogTitle>
        <DialogDescription className="sr-only">Ketik perintah untuk agen atau cari halaman</DialogDescription>
        <div className="flex items-center gap-2.5 border-b px-4">
          <MagicWandIcon className="h-4 w-4 shrink-0 text-primary" />
          <input id="cmdk-input" value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} onKeyDown={onKey}
            placeholder={running ? 'Agen sedang bekerja…' : 'Tanya agen atau cari halaman…'} aria-label="Perintah" autoComplete="off"
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" />
          <kbd className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">Esc</kbd>
        </div>
        <div role="listbox" className="max-h-[22rem] overflow-y-auto p-2">
          {items.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Tidak ada hasil. Tekan Enter untuk bertanya ke agen.</p>}
          {items.map((it, i) => {
            const header = it.group !== lastGroup; lastGroup = it.group;
            return (
              <React.Fragment key={it.id}>
                {header && <div className="px-3 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{it.group}</div>}
                <button type="button" role="option" aria-selected={i === idx} onMouseMove={() => setIdx(i)} onClick={it.run}
                  className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors', i === idx ? 'bg-primary/10 text-foreground' : 'text-foreground/90')}>
                  <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-md', it.icon === 'agent' ? 'bg-primary text-white' : 'bg-slate-100 text-muted-foreground dark:bg-white/10')}>
                    {it.icon === 'agent' ? <MagicWandIcon className="h-3.5 w-3.5" /> : <ExternalLinkIcon className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{it.label}</span>
                  {it.hint && <span className="shrink-0 text-xs text-muted-foreground">{it.hint}</span>}
                  {i === idx && <ArrowRightIcon className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <div className="flex items-center gap-3 border-t px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><MagnifyingGlassIcon className="h-3 w-3" />↑↓ pilih · Enter jalankan</span>
          <span className="ml-auto">Ctrl K</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
