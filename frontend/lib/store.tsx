'use client';

/* State aplikasi. Sumber data: backend Go + PostgreSQL (GET /api/bootstrap, lalu POST/PATCH/DELETE).
   Perubahan diterapkan langsung di UI (optimistik) lalu disimpan ke backend; bila gagal, data dimuat ulang dari server.
   Data contoh (lib/data.ts) hanya tampil sementara dimuat atau bila backend tidak terjangkau. */
import * as React from 'react';
import { seed, NOW, STAGES } from './data';
import { backendFetch, setToken } from './backend';
import type { Device, Detection, Patient, User, WebformRow, OfflineRow, PrimerRow } from './types';

export interface Store {
  user: User | null;
  ready: boolean;   // sesi sudah dibaca dari sessionStorage (hanya di browser)
  devices: Device[];
  detections: Detection[];
  patients: Patient[];
  datasets: { webform: WebformRow[]; offline: OfflineRow[]; primer: PrimerRow[] };
  login: (u: User, token: string) => void;
  logout: () => void;
  addDetection: (d: Detection) => void;
  updateDetection: (uuid: string, patch: Partial<Detection>) => void;   
  removeDetections: (uuids: string[]) => void;                         
  addDevice: (d: Device) => void;                                     
  updateDevice: (id: number, patch: Partial<Device>) => void;          
  removeDevice: (id: number) => void;                                  
  addPatient: (p: Patient) => void;                                   
  updatePatient: (id: string, patch: Partial<Patient>) => void;        
  removePatient: (id: string) => void;                                 
  device: (id: number | string) => Device | undefined;
  detection: (uuid: string) => Detection | undefined;
}

const Ctx = React.createContext<Store | null>(null);
const KEY = 'tbv_user';

async function api(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown) {
  const res = await backendFetch(`/api${path}`, {
    method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status}`);
}
const readUser = (): User | null => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; } };

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [ready, setReady] = React.useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage hanya ada di browser
  React.useEffect(() => { setUser(readUser()); setReady(true); }, []);
  const [devices, setDevices] = React.useState<Device[]>(() => structuredClone(seed.devices));
  const [detections, setDetections] = React.useState<Detection[]>(() => structuredClone(seed.detections));
  const [patients, setPatients] = React.useState<Patient[]>(() => structuredClone(seed.patients));
  const [datasets, setDatasets] = React.useState<Store['datasets']>(() => ({ webform: seed.webform, offline: seed.offline, primer: seed.primer }));

  const load = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await backendFetch('/api/bootstrap', { signal, cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setDevices(d.devices); setDetections(d.detections); setPatients(d.patients); setDatasets(d.datasets);
    } catch (e) {
      if (!signal?.aborted) console.warn('[store] backend tidak terjangkau, memakai data contoh:', e);
    }
  }, []);
  const logout = React.useCallback(() => { setToken(''); setUser(null); try { sessionStorage.removeItem(KEY); } catch { /* mode privat */ } }, []);
  // sesi kedaluwarsa / ditolak server -> keluar
  React.useEffect(() => { window.addEventListener('tbv:unauthorized', logout); return () => window.removeEventListener('tbv:unauthorized', logout); }, [logout]);
  // data hanya dimuat setelah login (backend menolak tanpa token)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- muat data dari backend saat login
  React.useEffect(() => { if (!user) return; const c = new AbortController(); load(c.signal); return () => c.abort(); }, [user, load]);
  /** simpan ke backend; gagal -> sinkronkan ulang dari server */
  const sync = (...args: Parameters<typeof api>) => { api(...args).catch((e) => { console.warn('[store] gagal menyimpan:', e); load(); }); };

  const value: Store = {
    user, ready, devices, detections, patients, datasets,
    login: (u, token) => { setToken(token); setUser(u); try { sessionStorage.setItem(KEY, JSON.stringify(u)); } catch { /* mode privat */ } },
    logout,
    addDetection: (d) => { setDetections((all) => [d, ...all]); sync('POST', '/detections', d); },
    updateDetection: (uuid, patch) => { setDetections((all) => all.map((d) => (d.uuid === uuid ? { ...d, ...patch } : d))); sync('PATCH', `/detections/${encodeURIComponent(uuid)}`, patch); },
    removeDetections: (uuids) => { setDetections((all) => all.filter((d) => !uuids.includes(d.uuid))); sync('POST', '/detections/delete', { uuids }); },
    addDevice: (d) => { setDevices((all) => [...all, d]); sync('POST', '/devices', d); },
    updateDevice: (id, patch) => { setDevices((all) => all.map((d) => (d.id === id ? { ...d, ...patch } : d))); sync('PATCH', `/devices/${id}`, patch); },
    removeDevice: (id) => { setDevices((all) => all.filter((d) => d.id !== id)); sync('DELETE', `/devices/${id}`); },
    addPatient: (p) => { setPatients((all) => [p, ...all]); sync('POST', '/patients', p); },
    updatePatient: (id, patch) => { setPatients((all) => all.map((p) => (p.id === id ? { ...p, ...patch } : p))); sync('PATCH', `/patients/${encodeURIComponent(id)}`, patch); },
    removePatient: (id) => { setPatients((all) => all.filter((p) => p.id !== id)); sync('DELETE', `/patients/${encodeURIComponent(id)}`); },
    device: (id) => devices.find((d) => d.id === +id),
    detection: (uuid) => detections.find((d) => d.uuid === uuid),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = React.useContext(Ctx);
  if (!s) throw new Error('useStore di luar StoreProvider');
  return s;
}

export { NOW, STAGES };
