'use client';

import * as React from 'react';
import {
  CheckIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  Cross2Icon,
  LightningBoltIcon,
} from '@radix-ui/react-icons';
import { AVAILABLE_MODELS, getModelInfo, type ModelOption } from '@/lib/agent/models';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface ModelPickerProps {
  currentModel: string;
  onSelectModel: (id: string) => void;
  className?: string;
  triggerVariant?: 'header' | 'footer' | 'pill';
}

export function ModelPicker({
  currentModel,
  onSelectModel,
  className,
  triggerVariant = 'header',
}: ModelPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const activeModel = getModelInfo(currentModel);

  // Shortcut Ctrl + / untuk membuka model picker
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  React.useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [open]);

  // Filter model berdasarkan pencarian
  const filteredModels = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return AVAILABLE_MODELS;
    return AVAILABLE_MODELS.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q) ||
        (m.badge && m.badge.toLowerCase().includes(q))
    );
  }, [search]);

  // Kelompokkan per Provider
  const grouped = React.useMemo(() => {
    const map = new Map<string, ModelOption[]>();
    for (const m of filteredModels) {
      const list = map.get(m.provider) || [];
      list.push(m);
      map.set(m.provider, list);
    }
    return map;
  }, [filteredModels]);

  const selectAndClose = (id: string) => {
    onSelectModel(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {triggerVariant === 'header' ? (
          <button
            type="button"
            className={cn(
              'group inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition hover:bg-slate-100 hover:text-foreground dark:hover:bg-white/10',
              className
            )}
            title="Klik untuk mengganti model AI (Ctrl+/)"
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                activeModel.category === 'groq' ? 'bg-amber-500' : 'bg-primary'
              )}
            />
            <span className="truncate">{activeModel.name}</span>
            <ChevronDownIcon className="h-3 w-3 shrink-0 opacity-60 transition-transform duration-200 group-hover:opacity-100" />
          </button>
        ) : triggerVariant === 'pill' ? (
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-medium shadow-sm backdrop-blur transition hover:border-primary/50 dark:border-white/15 dark:bg-card/80 dark:hover:border-primary/60',
              className
            )}
          >
            <LightningBoltIcon
              className={cn(
                'h-3.5 w-3.5',
                activeModel.category === 'groq' ? 'text-amber-500' : 'text-primary'
              )}
            />
            <span className="font-sans text-foreground">{activeModel.name}</span>
            <ChevronDownIcon className="h-3 w-3 text-muted-foreground" />
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:border-primary/40 hover:bg-slate-50 dark:border-white/15 dark:hover:bg-white/5',
              className
            )}
            title="Pilih Model AI (Ctrl+/)"
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                activeModel.category === 'groq' ? 'bg-amber-500' : 'bg-primary'
              )}
            />
            <span className="max-w-[130px] truncate">{activeModel.name}</span>
            <ChevronDownIcon className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[320px] rounded-xl border border-slate-200 bg-white p-0 shadow-xl dark:border-neutral-800 dark:bg-[#121214] sm:w-[360px]"
      >
        {/* Header & Search Bar */}
        <div className="border-b border-slate-100 p-2.5 dark:border-white/10">
          <div className="relative flex items-center">
            <MagnifyingGlassIcon className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Models..."
              className="h-8 w-full rounded-lg bg-slate-100 pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary dark:bg-neutral-800/80"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 text-muted-foreground hover:text-foreground"
              >
                <Cross2Icon className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Model List */}
        <div className="max-h-[340px] overflow-y-auto overscroll-contain p-1.5 text-xs">
          {filteredModels.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Model tidak ditemukan untuk "{search}"
            </div>
          ) : (
            Array.from(grouped.entries()).map(([provider, models]) => (
              <div key={provider} className="mb-2 last:mb-0">
                <div className="flex items-center gap-2 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  <span>{provider}</span>
                  <div className="h-px flex-1 bg-slate-100 dark:bg-white/[0.08]" />
                </div>

                <div className="space-y-0.5">
                  {models.map((m) => {
                    const isSelected = m.id === currentModel;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => selectAndClose(m.id)}
                        className={cn(
                          'group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition',
                          isSelected
                            ? 'bg-slate-100 font-medium text-foreground dark:bg-neutral-800'
                            : 'hover:bg-slate-50 text-foreground/80 hover:text-foreground dark:hover:bg-neutral-800/50'
                        )}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-mono">{m.id}</span>
                            {m.badge && (
                              <Badge
                                variant={
                                  m.badge.includes('Hemat')
                                    ? 'soft-success'
                                    : m.badge.includes('Groq') || m.badge.includes('Flagship')
                                    ? 'soft-warning'
                                    : 'soft-primary'
                                }
                                className="h-4 px-1 text-[9px]"
                              >
                                {m.badge}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <CheckIcon className="h-4 w-4 shrink-0 text-primary dark:text-blue-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info: Auto-Rotation & Shortcut */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-3 py-2 text-[11px] text-muted-foreground dark:border-white/10 dark:bg-neutral-900/60">
          <div className="flex items-center gap-1.5 text-success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            <span className="font-medium">85+ Groq Keys Aktif (Auto-Rotation)</span>
          </div>
          <span className="font-mono text-[10px] opacity-75">Ctrl + /</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
