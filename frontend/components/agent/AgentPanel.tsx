'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import {
  CheckIcon, ChevronDownIcon, Cross2Icon, CrossCircledIcon, ExclamationTriangleIcon, ExternalLinkIcon, MagicWandIcon,
  MagnifyingGlassIcon, PaperPlaneIcon, Pencil1Icon, PlusIcon, ReloadIcon, SewingPinIcon, SpeakerLoudIcon, SpeakerOffIcon, StopIcon, TrashIcon,
} from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useAgent, type Step, type Turn } from './AgentProvider';
import { Markdown } from './Markdown';
import { speak, stopSpeaking, ttsSupported, useRecorder, useSpeakingId } from './audio';

function MicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" className={cn('h-[15px] w-[15px]', className)} aria-hidden>
      <rect x="5" y="1.5" width="5" height="8" rx="2.5" /><path d="M3 7.5a4.5 4.5 0 0 0 9 0M7.5 12v1.5" />
    </svg>
  );
}

const turnText = (t: Turn) => t.parts.flatMap((p) => (p.kind === 'text' ? [p.text] : [])).join('\n\n');

function pageLabel(path: string) {
  if (path === '/') return 'Dashboard';
  if (path === '/devices/new') return 'Add Device';
  if (/^\/devices\/\d+/.test(path)) return `Perangkat #${path.split('/')[2]}`;
  if (path.startsWith('/devices')) return 'Device List';
  if (path.startsWith('/detections/')) return `Deteksi ${path.split('/')[2]}`;
  if (path.startsWith('/data/')) return `Data ${path.split('/')[2]}`;
  if (path.startsWith('/patients')) return 'Pelacakan Pasien';
  return path;
}

/** saran perintah sesuai halaman yang sedang dibuka */
function suggestions(path: string): string[] {
  if (path.startsWith('/devices/new') || path === '/devices') return ['Tambahkan perangkat TB Guard 5 di Puskesmas Gubeng, zona Ruang Tunggu Poli', 'Perangkat mana yang rusak atau tidak aktif, dan sejak kapan?', 'Ubah status TB Guard 4 menjadi inactive'];
  if (/^\/devices\/\d+/.test(path)) return ['Ringkas kondisi perangkat ini', 'Tandai semua deteksi TB perangkat ini sudah ditinjau', 'Jam berapa perangkat ini paling ramai batuk?'];
  if (path.startsWith('/detections/')) return ['Jelaskan hasil deteksi ini', 'Tandai deteksi ini sudah ditinjau dan beri label TB', 'Daftarkan individu di deteksi ini sebagai pasien'];
  if (path.startsWith('/patients')) return ['Siapa pasien dengan kepatuhan obat di bawah 90%?', 'Pasien mana yang dijadwalkan kunjungan minggu ini?', 'Majukan PSN-2510 ke tahap berikutnya'];
  if (path.startsWith('/data/')) return ['Berapa akurasi model di dataset ini?', 'Bandingkan hasil per gender', 'Tampilkan 5 data terbaru'];
  return ['Ada berapa batuk terindikasi TB yang belum ditinjau?', 'Jam berapa paling ramai batuk dalam 14 hari terakhir?', 'Tambah perangkat baru di Stasiun Wonokromo'];
}

const KIND_ICON = { read: MagnifyingGlassIcon, write: Pencil1Icon, delete: TrashIcon, ui: ExternalLinkIcon } as const;

function Spinner({ className }: { className?: string }) {
  return <span className={cn('inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent', className)} aria-hidden />;
}

function StepRow({ step, onDecide }: { step: Step; onDecide: (ok: boolean) => void }) {
  const [open, setOpen] = React.useState(false);
  const Icon = KIND_ICON[step.kind as keyof typeof KIND_ICON] ?? MagnifyingGlassIcon;
  const status = {
    running: <Spinner className="text-primary" />,
    done: <CheckIcon className="h-4 w-4 text-success" />,
    error: <CrossCircledIcon className="h-4 w-4 text-danger" />,
    awaiting: <ExclamationTriangleIcon className="h-4 w-4 text-pending" />,
    rejected: <Cross2Icon className="h-4 w-4 text-muted-foreground" />,
  }[step.status];
  return (
    <div className={cn('agent-step rounded-lg border bg-card text-xs', step.status === 'awaiting' && 'border-pending/60 ring-2 ring-pending/15', step.status === 'error' && 'border-danger/40')}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-2.5 py-2 text-left" aria-expanded={open}>
        <Icon className={cn('h-3.5 w-3.5 shrink-0', step.kind === 'delete' ? 'text-danger' : step.kind === 'write' ? 'text-primary dark:text-blue-300' : 'text-muted-foreground')} />
        <span className={cn('min-w-0 flex-1 truncate', step.status === 'rejected' && 'line-through opacity-60')}>{step.label}</span>
        {status}
        <ChevronDownIcon className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {step.status === 'error' && !open && <div className="border-t border-danger/20 px-2.5 py-1.5 text-danger">{step.error}</div>}
      {open && (
        <div className="max-h-56 overflow-auto border-t px-2.5 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
          <div className="mb-1 font-sans font-medium text-foreground">{step.name}</div>
          <pre className="whitespace-pre-wrap break-all">{JSON.stringify(step.args, null, 1)}</pre>
          {step.result !== undefined && <pre className="mt-2 whitespace-pre-wrap break-all border-t pt-2">{JSON.stringify(step.result, null, 1)}</pre>}
          {step.error && <div className="mt-2 border-t pt-2 font-sans text-danger">{step.error}</div>}
        </div>
      )}
      {step.status === 'awaiting' && (
        <div className="border-t px-2.5 py-2.5">
          <div className="text-[13px]"><Markdown text={step.confirm || 'Lanjutkan aksi ini?'} /></div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant={step.kind === 'delete' ? 'destructive' : 'default'} onClick={() => onDecide(true)}>Setujui</Button>
            <Button size="sm" variant="outline" onClick={() => onDecide(false)}>Tolak</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Reasoning({ text, live }: { text: string; live: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="text-xs text-muted-foreground">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 hover:text-foreground" aria-expanded={open}>
        {live ? <Spinner /> : <MagicWandIcon className="h-3.5 w-3.5" />}
        <span>{live ? 'Berpikir…' : 'Proses berpikir'}</span>
        <ChevronDownIcon className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="mt-1.5 whitespace-pre-wrap border-l-2 pl-3 leading-relaxed">{text}</div>}
    </div>
  );
}

function Dots() {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="Agen sedang bekerja">
      {[0, 150, 300].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60" style={{ animationDelay: `${d}ms` }} />)}
    </div>
  );
}

function SpeakButton({ turn }: { turn: Turn }) {
  const speaking = useSpeakingId() === turn.id;
  const [ok, setOk] = React.useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- dukungan browser baru diketahui setelah mount (SSR)
  React.useEffect(() => setOk(ttsSupported()), []);
  const text = turnText(turn);
  if (!ok || !text.trim()) return null;
  return (
    <button type="button" onClick={() => (speaking ? stopSpeaking() : speak(turn.id, text))}
      className={cn('-ml-1 inline-flex w-fit items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-white/10', speaking && 'text-primary dark:text-blue-300')}
      aria-label={speaking ? 'Hentikan suara' : 'Bacakan balasan'}>
      {speaking ? <SpeakerOffIcon className="h-3.5 w-3.5" /> : <SpeakerLoudIcon className="h-3.5 w-3.5" />}
      {speaking ? 'Hentikan' : 'Dengarkan'}
    </button>
  );
}

function AssistantTurn({ turn, last }: { turn: Turn; last: boolean }) {
  const { decide, retry, running } = useAgent();
  const tail = turn.parts[turn.parts.length - 1];
  const busy = !turn.done;
  return (
    <div className="grid gap-2.5">
      {turn.parts.map((p, i) => {
        if (p.kind === 'reasoning') return <Reasoning key={i} text={p.text} live={busy && i === turn.parts.length - 1} />;
        if (p.kind === 'text') return <Markdown key={i} text={p.text} />;
        return <StepRow key={p.step.id} step={p.step} onDecide={(ok) => decide(p.step.id, ok)} />;
      })}
      {busy && turn.notice && <div className="flex items-center gap-2 text-xs text-pending"><Spinner />{turn.notice}</div>}
      {busy && (!tail || tail.kind === 'step') && !(tail?.kind === 'step' && tail.step.status === 'awaiting') && <Dots />}
      {turn.error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {turn.error}
          {last && !running && <button type="button" onClick={retry} className="ml-2 inline-flex items-center gap-1 font-medium underline"><ReloadIcon className="h-3 w-3" />Coba lagi</button>}
        </div>
      )}
      {turn.done && !turn.error && !turn.parts.length && <p className="text-xs text-muted-foreground">Dihentikan.</p>}
      {turn.done && <SpeakButton turn={turn} />}
    </div>
  );
}

export function AgentPanel({ className, onClose }: { className?: string; onClose: () => void }) {
  const { turns, running, send, stop, reset, confirmRisky, setConfirmRisky } = useAgent();
  const { user } = useStore();
  const path = usePathname() || '/';
  const [text, setText] = React.useState('');
  const scroller = React.useRef<HTMLDivElement>(null);
  const input = React.useRef<HTMLTextAreaElement>(null);
  const stick = React.useRef(true);
  const submit = (q = text) => { if (!q.trim() || running) return; stick.current = true; stopSpeaking(); send(q); setText(''); };
  const [audioErr, setAudioErr] = React.useState('');
  // pesan dari suara → balasannya otomatis dibacakan
  const voiceReply = React.useRef(false);
  const rec = useRecorder((t) => { setAudioErr(''); voiceReply.current = true; submit(t); }, setAudioErr);
  const [micOk, setMicOk] = React.useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- dukungan browser baru diketahui setelah mount (SSR)
  React.useEffect(() => setMicOk(rec.supported), [rec.supported]);

  React.useEffect(() => {
    const last = turns[turns.length - 1];
    if (!voiceReply.current || !last || last.role !== 'assistant' || !last.done) return;
    voiceReply.current = false;
    if (!last.error) speak(last.id, turnText(last));
  }, [turns]);
  React.useEffect(() => () => stopSpeaking(), []);

  React.useEffect(() => { input.current?.focus(); }, []);
  // ikuti pesan terbaru, kecuali pengguna sedang menggulir ke atas
  React.useEffect(() => { const el = scroller.current; if (el && stick.current) el.scrollTop = el.scrollHeight; }, [turns]);
  React.useEffect(() => { const el = input.current; if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px'; } }, [text]);


  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex h-[67px] shrink-0 items-center gap-3 border-b border-slate-200 px-4 dark:border-white/10">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-white shadow-box"><MagicWandIcon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="font-medium leading-tight">TB Guard Agent</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn('h-1.5 w-1.5 rounded-full', running ? 'animate-pulse bg-pending' : 'bg-success')} />{running ? 'Sedang bekerja…' : 'Siap · Groq Qwen3'}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { stopSpeaking(); reset(); }} title="Percakapan baru" aria-label="Percakapan baru"><PlusIcon /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} title="Tutup (Ctrl+I)" aria-label="Tutup panel agen"><Cross2Icon /></Button>
      </div>

      <div ref={scroller} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
        {turns.length === 0 ? (
          <div className="flex flex-col">
            <div className="mt-2">
              <div className="text-lg font-medium">Halo{user?.name ? `, ${user.name}` : ''} 👋</div>
              <p className="mt-1 text-muted-foreground">Saya bisa membaca, menganalisis, dan mengubah data TB Guard: perangkat, deteksi batuk, pasien, dan dataset penelitian. Cukup minta dengan bahasa biasa.</p>
            </div>
            <div className="mt-6 text-xs font-medium uppercase text-muted-foreground">Coba</div>
            <div className="mt-2 grid gap-2">
              {suggestions(path).map((s) => (
                <button key={s} type="button" onClick={() => submit(s)} className="box rounded-lg border px-3 py-2.5 text-left text-sm transition hover:border-primary/40 hover:shadow-box-lg">{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-5">
            {turns.map((t, i) => (t.role === 'user'
              ? <div key={t.id} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-white">{t.text}</div>
              : <AssistantTurn key={t.id} turn={t} last={i === turns.length - 1} />))}
          </div>
        )}
      </div>

      <form className="shrink-0 border-t border-slate-200 p-3 dark:border-white/10" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="box rounded-xl border transition focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
          {rec.state !== 'idle' ? (
            <div className="flex items-center gap-2.5 px-3 pb-1 pt-2.5 text-sm" role="status">
              {rec.state === 'recording'
                ? <><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />Merekam… <span className="tabular-nums text-muted-foreground">{Math.floor(rec.seconds / 60)}:{String(rec.seconds % 60).padStart(2, '0')}</span></>
                : <><Spinner className="text-primary" />Mentranskripsi suara…</>}
            </div>
          ) : <textarea ref={input} rows={1} value={text} onChange={(e) => setText(e.target.value)} aria-label="Pesan untuk agen"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
            placeholder="Minta apa saja, mis. tambah perangkat baru…"
            className="block max-h-40 w-full resize-none bg-transparent px-3 pb-1 pt-2.5 text-sm outline-none placeholder:text-muted-foreground" />}
          <div className="flex items-center gap-2 px-2 pb-2">
            <span className="inline-flex max-w-[45%] items-center gap-1 truncate rounded-md bg-slate-100 px-2 py-1 text-[11px] text-muted-foreground dark:bg-white/10" title="Konteks halaman dikirim ke agen">
              <SewingPinIcon className="h-3 w-3 shrink-0" /><span className="truncate">{pageLabel(path)}</span>
            </span>
            <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground" title="Minta persetujuan sebelum menghapus atau mengubah banyak data">
              <Switch checked={confirmRisky} onCheckedChange={setConfirmRisky} className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span[data-state=checked]]:translate-x-3" aria-label="Konfirmasi aksi berisiko" />
              Konfirmasi
            </label>
            {rec.state === 'recording' ? (
              <span className="ml-auto flex gap-1.5">
                <Button type="button" size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={rec.cancel} title="Batalkan rekaman" aria-label="Batalkan rekaman"><Cross2Icon /></Button>
                <Button type="button" size="icon" className="h-8 w-8 rounded-full" onClick={rec.stop} title="Selesai & kirim" aria-label="Selesai merekam dan kirim"><CheckIcon /></Button>
              </span>
            ) : running
              ? <Button type="button" size="icon" variant="outline" className="ml-auto h-8 w-8 rounded-full" onClick={stop} title="Hentikan" aria-label="Hentikan agen"><StopIcon /></Button>
              : text.trim() || !micOk
                ? <Button type="submit" size="icon" className="ml-auto h-8 w-8 rounded-full" disabled={!text.trim() || rec.state !== 'idle'} title="Kirim (Enter)" aria-label="Kirim"><PaperPlaneIcon /></Button>
                : <Button type="button" size="icon" variant="outline" className="ml-auto h-8 w-8 rounded-full" disabled={rec.state !== 'idle'} onClick={() => { setAudioErr(''); stopSpeaking(); void rec.start(); }} title="Bicara (rekam suara)" aria-label="Rekam suara"><MicIcon /></Button>}
          </div>
        </div>
        {audioErr && <p className="mt-1.5 px-1 text-[11px] text-danger">{audioErr}</p>}
        <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">Enter kirim · Shift+Enter baris baru · 🎤 bicara · Ctrl+I buka/tutup</p>
      </form>
    </div>
  );
}
