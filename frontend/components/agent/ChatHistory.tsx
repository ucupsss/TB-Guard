'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { CheckIcon, ChatBubbleIcon, Cross2Icon, MagnifyingGlassIcon, Pencil1Icon, PlusIcon, StarFilledIcon, StarIcon, TrashIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAgent, type ChatSummary } from './AgentProvider';

const nf = (n: number) => n.toLocaleString('id-ID');
const rtf = new Intl.RelativeTimeFormat('id', { numeric: 'auto' });
function ago(t: number) {
  const s = Math.round((t - Date.now()) / 1000), a = Math.abs(s);
  if (a < 60) return 'baru saja';
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}

/** Daftar chat tersimpan (database): buka, ganti nama, sematkan, hapus. */
export function ChatHistory({ onClose }: { onClose: () => void }) {
  const { chats, chatsLoading, chatId, running, openChat, renameChat, pinChat, deleteChat, clearChats, reset, historyError, retrySave } = useAgent();
  const [q, setQ] = React.useState('');
  const [editing, setEditing] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const [confirm, setConfirm] = React.useState<string | null>(null);
  const [confirmAll, setConfirmAll] = React.useState(false);

  const guard = async (fn: () => Promise<void>) => { try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal'); } };
  const shown = chats.filter((c) => c.title.toLowerCase().includes(q.trim().toLowerCase()));
  const open = (c: ChatSummary) => guard(async () => { await openChat(c.id); onClose(); });
  const save = (c: ChatSummary) => guard(async () => { const t = draft.trim(); setEditing(null); if (t && t !== c.title) await renameChat(c.id, t); });
  const totalTokens = chats.reduce((n, c) => n + c.tokens, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 p-3 dark:border-white/10">
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari percakapan…" aria-label="Cari percakapan"
            className="h-9 w-full rounded-md border bg-transparent pl-8 pr-2 text-sm outline-none focus:border-primary/50" />
        </div>
        <Button size="sm" className="h-9 gap-1" disabled={running} onClick={() => { reset(); onClose(); }}><PlusIcon />Baru</Button>
      </div>

      {historyError && (
        <div role="alert" className="mx-3 mt-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          <span className="min-w-0 flex-1">{historyError}</span>
          <button type="button" className="shrink-0 font-medium underline" onClick={retrySave}>Coba lagi</button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {chatsLoading && chats.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Memuat…</p>}
        {!chatsLoading && shown.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">{chats.length ? 'Tidak ada yang cocok.' : 'Belum ada percakapan tersimpan.'}</p>
        )}
        {shown.map((c) => {
          const active = c.id === chatId;
          return (
            <div key={c.id} className={cn('group rounded-lg px-3 py-2.5 transition', active ? 'bg-primary/10' : 'hover:bg-black/5 dark:hover:bg-white/5')}>
              {editing === c.id ? (
                <div className="flex items-center gap-1.5">
                  <input autoFocus value={draft} maxLength={80} onChange={(e) => setDraft(e.target.value)} aria-label="Judul percakapan"
                    onKeyDown={(e) => { if (e.key === 'Enter') void save(c); if (e.key === 'Escape') setEditing(null); }}
                    className="h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-sm outline-none focus:border-primary/50" />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void save(c)} aria-label="Simpan judul"><CheckIcon /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(null)} aria-label="Batal"><Cross2Icon /></Button>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <button type="button" onClick={() => void open(c)} className="min-w-0 flex-1 text-left" disabled={running}>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      {c.pinned ? <StarFilledIcon className="h-3.5 w-3.5 shrink-0 text-pending" /> : <ChatBubbleIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      <span className="truncate">{c.title || 'Percakapan'}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{c.turns} pesan · {nf(c.tokens)} token · {ago(c.updatedAt)}</div>
                  </button>
                  {confirm === c.id ? (
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-danger" onClick={() => { setConfirm(null); void guard(() => deleteChat(c.id)); }} aria-label="Konfirmasi hapus"><CheckIcon /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirm(null)} aria-label="Batal hapus"><Cross2Icon /></Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void guard(() => pinChat(c.id, !c.pinned))} title={c.pinned ? 'Lepas sematan' : 'Sematkan'} aria-label={c.pinned ? 'Lepas sematan' : 'Sematkan'}>{c.pinned ? <StarFilledIcon /> : <StarIcon />}</Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(c.id); setDraft(c.title); }} title="Ganti nama" aria-label="Ganti nama"><Pencil1Icon /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirm(c.id)} title="Hapus" aria-label="Hapus"><TrashIcon /></Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-200 px-4 py-2.5 text-xs text-muted-foreground dark:border-white/10">
        <span>{chats.length} percakapan · {nf(totalTokens)} token</span>
        {confirmAll ? (
          <span className="ml-auto flex items-center gap-2">
            Hapus yang tidak disematkan?
            <button type="button" className="font-medium text-danger hover:underline" onClick={() => { setConfirmAll(false); void guard(clearChats); }}>Ya</button>
            <button type="button" className="hover:underline" onClick={() => setConfirmAll(false)}>Batal</button>
          </span>
        ) : (
          <button type="button" className="ml-auto text-danger hover:underline disabled:opacity-50" disabled={!chats.some((c) => !c.pinned) || running} onClick={() => setConfirmAll(true)}>Hapus semua</button>
        )}
      </div>
    </div>
  );
}
