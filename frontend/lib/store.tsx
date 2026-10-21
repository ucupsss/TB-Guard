'use client';

/* State aplikasi (pengganti API). Semua perubahan disimpan di memori sampai halaman di-reload.
   Saat backend siap, ganti isi aksi di bawah dengan fetch() ke Express. */
import * as React from 'react';
import { seed, NOW, STAGES } from './data';
import type { Device, Detection, Patient, User, WebformRow, OfflineRow, PrimerRow } from './types';

export interface Store {
  user: User | null;
  ready: boolean;   // sesi sudah dibaca dari sessionStorage (hanya di browser)
  devices: Device[];
  detections: Detection[];
  patients: Patient[];
  datasets: { webform: WebformRow[]; offline: OfflineRow[]; primer: PrimerRow[] };
  login: (u: User) => void;
  logout: () => void;
  updateDetection: (uuid: string, patch: Partial<Detection>) => void;   // nanti: PATCH /api/detections/:uuid
  removeDetections: (uuids: string[]) => void;                         // nanti: DELETE /api/detections/:uuid
  addDevice: (d: Device) => void;                                     // nanti: POST /api/devices
  updateDevice: (id: number, patch: Partial<Device>) => void;          // nanti: PATCH /api/devices/:id
  removeDevice: (id: number) => void;                                  // nanti: DELETE /api/devices/:id
  addPatient: (p: Patient) => void;                                   // nanti: POST /api/patients
  updatePatient: (id: string, patch: Partial<Patient>) => void;        // nanti: PATCH /api/patients/:id
  removePatient: (id: string) => void;                                 // nanti: DELETE /api/patients/:id
  device: (id: number | string) => Device | undefined;
  detection: (uuid: string) => Detection | undefined;
}

const Ctx = React.createContext<Store | null>(null);
const KEY = 'tbv_user';
const readUser = (): User | null => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; } };

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [ready, setReady] = React.useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage hanya ada di browser
  React.useEffect(() => { setUser(readUser()); setReady(true); }, []);
  const [devices, setDevices] = React.useState<Device[]>(() => structuredClone(seed.devices));
  const [detections, setDetections] = React.useState<Detection[]>(() => structuredClone(seed.detections));
  const [patients, setPatients] = React.useState<Patient[]>(() => structuredClone(seed.patients));
  const datasets = React.useMemo(() => ({ webform: seed.webform, offline: seed.offline, primer: seed.primer }), []);

  const value: Store = {
    user, ready, devices, detections, patients, datasets,
    login: (u) => { setUser(u); try { sessionStorage.setItem(KEY, JSON.stringify(u)); } catch { /* mode privat */ } },
    logout: () => { setUser(null); try { sessionStorage.removeItem(KEY); } catch { /* mode privat */ } },
    updateDetection: (uuid, patch) => setDetections((all) => all.map((d) => (d.uuid === uuid ? { ...d, ...patch } : d))),
    removeDetections: (uuids) => setDetections((all) => all.filter((d) => !uuids.includes(d.uuid))),
    addDevice: (d) => setDevices((all) => [...all, d]),
    updateDevice: (id, patch) => setDevices((all) => all.map((d) => (d.id === id ? { ...d, ...patch } : d))),
    removeDevice: (id) => setDevices((all) => all.filter((d) => d.id !== id)),
    addPatient: (p) => setPatients((all) => [p, ...all]),
    updatePatient: (id, patch) => setPatients((all) => all.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    removePatient: (id) => setPatients((all) => all.filter((p) => p.id !== id)),
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
