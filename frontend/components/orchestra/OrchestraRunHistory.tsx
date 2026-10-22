'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { ChatBubbleIcon, CounterClockwiseClockIcon, LightningBoltIcon, MixerHorizontalIcon, PersonIcon, TrashIcon } from '@radix-ui/react-icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { deleteRun, getRun, listRuns, RUN_SAVED_EVENT, toTranscript, type Run, type RunSummary } from '@/lib/agent/orchestra-runs';
import type { SubAgent } from '@/lib/agent/orchestrator';

const when = (t: number) => new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Riwayat jalannya Orchestra (tersimpan di database) yang dibaca seperti percakapan: siapa membagi tugas, siapa mengerjakan apa. */
export function OrchestraRunHistory({ agents }: { agents: SubAgent[] }) {
  const [runs, setRuns] = React.useState<RunSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState<Run | null>(null);
  const [confirm, setConfirm] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try { setRuns(await listRuns()); } catch { toast.error('Riwayat Orchestra belum bisa dimuat.'); }
    finally { setLoading(false); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- muat riwayat dari database saat tab dibuka
  React.useEffect(() => { void refresh(); window.addEventListener(RUN_SAVED_EVENT, refresh); return () => window.removeEventListener(RUN_SAVED_EVENT, refresh); }, [refresh]);

  const show = async (id: string) => { try { setOpen(await getRun(id)); } catch { toast.error('Rekaman tidak ditemukan.'); } };
  const remove = async (id: string) => {
    try { await deleteRun(id); if (open?.id === id) setOpen(null); setConfirm(null); await refresh(); } catch { toast.error('Gagal menghapus rekaman.'); }
  };
  const nameOf = (id: string) => agents.find((a) => a.id === id)?.name ?? id;
  const messages = open ? toTranscript(open, nameOf) : [];

  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <div className="box p-4 sm:p-5 xl:col-span-2">
        <div className="flex items-center gap-2">
          <CounterClockwiseClockIcon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Riwayat tersimpan</h3>
          <span className="ml-auto text-xs text-muted-foreground">{runs.length} rekaman</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Setiap pertanyaan di chat agen dan setiap simulasi disimpan di database. Buka salah satunya untuk melihat bagaimana Orchestra bekerja, seperti membaca percakapan.</p>
        <ScrollArea className="mt-3 h-[28rem] pr-2">
          {loading && <p className="p-6 text-center text-sm text-muted-foreground">Memuat...</p>}
          {!loading && !runs.length && <p className="p-6 text-center text-sm text-muted-foreground">Belum ada rekaman. Tanya sesuatu di chat agen atau jalankan simulasi di kanvas.</p>}
          <div className="grid gap-2">
            {runs.map((r) => (
              <div key={r.id} className={cn('rounded-lg border p-3 transition-colors', open?.id === r.id ? 'border-primary bg-primary/5' : 'hover:bg-black/5 dark:hover:bg-white/5')}>
                <div className="flex items-start gap-2">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void show(r.id)}>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={r.source === 'live' ? 'default' : 'outline'} className="text-[10px]">{r.source === 'live' ? 'Chat live' : 'Simulasi'}</Badge>
                      <span className="text-[11px] text-muted-foreground">{when(r.createdAt)}</span>
                    </div>
                    <div className="mt-1 line-clamp-2 text-sm font-medium text-foreground">{r.prompt || r.scenario || 'Tanpa judul'}</div>
                    <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{r.steps} langkah &middot; {r.totalMs} ms{r.tokens ? ` · ${r.tokens} token` : ''}</div>
                  </button>
                  {confirm === r.id ? (
                    <span className="flex items-center gap-1 text-xs">
                      <button type="button" className="font-medium text-danger hover:underline" onClick={() => void remove(r.id)}>Hapus</button>
                      <button type="button" className="text-muted-foreground hover:underline" onClick={() => setConfirm(null)}>Batal</button>
                    </span>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirm(r.id)} aria-label="Hapus rekaman"><TrashIcon className="text-danger" /></Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="box p-4 sm:p-5 xl:col-span-3">
        <div className="flex items-center gap-2">
          <ChatBubbleIcon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Bagaimana Orchestra mengerjakannya</h3>
        </div>
        {!open ? (
          <p className="mt-6 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Pilih satu rekaman di sebelah kiri untuk membacanya sebagai percakapan.</p>
        ) : (
          <ScrollArea className="mt-3 h-[30rem] pr-2">
            <div className="grid gap-3">
              {messages.map((m, i) => (
                <div key={i} className={cn('flex gap-2.5', m.role === 'user' && 'flex-row-reverse')}>
                  <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full', m.role === 'user' ? 'bg-primary text-white' : m.role === 'orchestrator' ? 'bg-slate-800 text-white dark:bg-slate-600' : 'bg-primary/10 text-primary')}>
                    {m.role === 'user' ? <PersonIcon className="h-4 w-4" /> : m.role === 'orchestrator' ? <MixerHorizontalIcon className="h-4 w-4" /> : <LightningBoltIcon className="h-4 w-4" />}
                  </span>
                  <div className={cn('max-w-[85%] rounded-xl border px-3.5 py-2.5', m.role === 'user' ? 'border-primary/30 bg-primary/5' : 'bg-card')}>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><b className="font-medium text-foreground">{m.who}</b>{m.meta && <span className="tabular-nums">{m.meta}</span>}</div>
                    <p className="mt-0.5 text-sm leading-relaxed text-foreground">{m.text}</p>
                    {m.result && <pre className="mt-1.5 whitespace-pre-wrap rounded-md bg-slate-50 p-2 font-mono text-[11px] leading-snug text-muted-foreground dark:bg-white/5">{m.result}</pre>}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
