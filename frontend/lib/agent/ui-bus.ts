'use client';

/* Bus perintah UI: agen mengendalikan tampilan aplikasi (kamera 3D, filter tabel, modal, tema).
   Perintah yang dikirim sebelum halaman tujuan selesai dimuat disimpan sebentar (pending) lalu
   diteruskan begitu komponen pendengarnya terpasang, sehingga "navigasi + aksi" terasa satu gerakan. */
import * as React from 'react';

export type CameraPreset = 'overview' | 'sensor' | 'target';
export type UiCommand =
  | { type: '3d'; camera?: CameraPreset; triggerCough?: boolean }
  | { type: 'filter-devices'; status?: 'active' | 'inactive' | 'broken' | ''; query?: string }
  | { type: 'open-detection'; uuid: string }
  | { type: 'theme'; mode: 'dark' | 'light' };

type Kind = UiCommand['type'];
const PENDING_TTL = 15_000;
const listeners = new Map<Kind, Set<(c: UiCommand) => void>>();
let pending: { cmd: UiCommand; at: number }[] = [];

export function sendUi(cmd: UiCommand) {
  const ls = listeners.get(cmd.type);
  if (ls && ls.size) ls.forEach((l) => l(cmd));
  else pending.push({ cmd, at: Date.now() });
}

/** Dengarkan satu jenis perintah. Perintah yang menunggu (belum kedaluwarsa) langsung diteruskan saat dipasang. */
export function useUiCommand<K extends Kind>(type: K, handler: (c: Extract<UiCommand, { type: K }>) => void) {
  const ref = React.useRef(handler);
  React.useEffect(() => { ref.current = handler; });
  React.useEffect(() => {
    const fn = (c: UiCommand) => ref.current(c as Extract<UiCommand, { type: K }>);
    let set = listeners.get(type);
    if (!set) { set = new Set(); listeners.set(type, set); }
    set.add(fn);
    const now = Date.now();
    const mine = pending.filter((p) => p.cmd.type === type && now - p.at < PENDING_TTL);
    pending = pending.filter((p) => p.cmd.type !== type && now - p.at < PENDING_TTL);
    mine.forEach((p) => fn(p.cmd));
    return () => { set.delete(fn); };
  }, [type]);
}
