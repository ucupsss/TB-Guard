/* Eksekutor tool agen: jalan di browser, membaca & mengubah store aplikasi.
   Hasil dibuat ringkas (JSON kecil) supaya hemat token, dan selalu menyertakan `link` halaman. */
import { NOW, STAGES } from '@/lib/data';
import { fmt } from '@/lib/format';
import type { Store } from '@/lib/store';
import type { Detection, Device, DeviceStatus, Patient } from '@/lib/types';

const DAY = 86400000;
type Args = Record<string, unknown>;

export interface ToolEnv { store: () => Store; navigate: (path: string) => void }
/** aksi yang perlu persetujuan: null = langsung jalan; string = kalimat yang ditampilkan di kartu konfirmasi */
export interface Prepared { confirm: string | null; run: () => unknown }

export class ToolError extends Error {}
const fail = (msg: string): never => { throw new ToolError(msg); };

// nilai null/'' dari model dianggap "tidak diisi"
const has = (a: Args, k: string) => a[k] !== undefined && a[k] !== null && a[k] !== '';
const clean = <T extends Args>(o: T | undefined) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Partial<T>;

const ymd = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const parseDate = (s: string) => { const t = Date.parse(s.length === 10 ? s + 'T09:00:00+07:00' : s); return Number.isFinite(t) ? t : fail(`Tanggal tidak valid: ${s}`); };

const devOut = (d: Device, s: Store) => {
  const det = s.detections.filter((x) => x.deviceId === d.id);
  return {
    id: d.id, name: d.name, status: d.status, type: d.type, location: d.location, zone: d.zone, city: d.city,
    mics: d.mics, array: d.array, camera: d.camera, fw: d.fw, installed: d.installed, last_seen: fmt.ago(d.lastSeen),
    detections: det.length, tb: det.filter((x) => x.result === 'TB').length, link: `/devices/${d.id}`,
  };
};
const detOut = (d: Detection, s: Store) => ({
  uuid: d.uuid, device: `${s.device(d.deviceId)?.name ?? 'dihapus'} (#${d.deviceId})`, time: fmt.dateTime(d.time), type: d.type,
  result: d.result, confidence: d.confidence, reviewed: d.reviewed, verified: d.verified ?? null,
  ...(d.name ? { name: d.name, gender: d.gender, age: d.age } : {}), link: `/detections/${d.uuid}`,
});
const patOut = (p: Patient) => ({
  id: p.id, name: p.name, gender: p.gender, age: p.age, stage: `${p.stage} ${STAGES[p.stage]}`, facility: p.facility, pic: p.pic,
  days_in: p.daysIn, adherence: p.adherence, next_visit: p.nextVisit ? fmt.dateShort(p.nextVisit) : null, detection_uuid: p.uuid,
  link: `/patients?open=${p.id}`,
});

function findDevice(s: Store, id: unknown) { return s.device(Number(id)) ?? fail(`Perangkat #${id} tidak ditemukan. Gunakan list_devices untuk melihat ID yang ada.`); }
function findPatient(s: Store, id: unknown) { return s.patients.find((p) => p.id.toLowerCase() === String(id).toLowerCase()) ?? fail(`Pasien ${id} tidak ditemukan.`); }

function filterDetections(s: Store, a: Args) {
  let list = s.detections;
  if (has(a, 'device_id')) list = list.filter((d) => d.deviceId === Number(a.device_id));
  if (has(a, 'result')) list = list.filter((d) => d.result === a.result);
  if (has(a, 'reviewed')) list = list.filter((d) => d.reviewed === a.reviewed);
  if (has(a, 'verified')) list = list.filter((d) => (a.verified === 'none' ? !d.verified : d.verified === a.verified));
  if (has(a, 'type')) list = list.filter((d) => d.type === a.type);
  if (has(a, 'since_days')) list = list.filter((d) => d.time >= NOW.getTime() - Number(a.since_days) * DAY);
  if (has(a, 'date')) list = list.filter((d) => ymd(d.time) === a.date);
  if (has(a, 'min_confidence')) list = list.filter((d) => d.confidence >= Number(a.min_confidence));
  if (has(a, 'query')) { const q = String(a.query).toLowerCase(); list = list.filter((d) => (d.uuid + ' ' + d.name).toLowerCase().includes(q)); }
  return list;
}

const DEVICE_STATUS = ['active', 'inactive', 'broken'];
function devicePatch(p: Args): Partial<Device> {
  const out: Partial<Device> = {};
  for (const k of ['name', 'type', 'location', 'zone', 'city', 'fw'] as const) if (has(p, k)) out[k] = String(p[k]).trim();
  if (has(p, 'status')) out.status = (DEVICE_STATUS.includes(String(p.status)) ? p.status : fail(`Status harus active/inactive/broken`)) as DeviceStatus;
  if (has(p, 'mics')) { const m = Number(p.mics); out.mics = m; out.array = m === 6 ? 'Linear 6-Mic Array' : `ReSpeaker ${m}-Mic Circular`; }
  if (has(p, 'camera')) out.camera = p.camera ? 'USB Cam 1080p' : '—';
  if (has(p, 'lat')) out.lat = Number(p.lat);
  if (has(p, 'lng')) out.lng = Number(p.lng);
  return out;
}

const plural = (n: number, w: string) => `${n} ${w}`;

export function prepareTool(name: string, a: Args, env: ToolEnv, opts: { confirmRisky: boolean }): Prepared {
  const s = env.store();
  const now = NOW.getTime();
  const ask = (msg: string) => (opts.confirmRisky ? msg : null);
  const read = (run: () => unknown): Prepared => ({ confirm: null, run });

  switch (name) {
    case 'get_overview': return read(() => {
      const d = s.detections, week = d.filter((x) => x.time >= now - 7 * DAY);
      return {
        system_time: fmt.longDate(now),
        devices: { total: s.devices.length, ...Object.fromEntries(DEVICE_STATUS.map((st) => [st, s.devices.filter((x) => x.status === st).length])) },
        detections: { total: d.length, tb: d.filter((x) => x.result === 'TB').length, tb_unreviewed: d.filter((x) => x.result === 'TB' && !x.reviewed).length,
          non_cough: d.filter((x) => x.type === '-').length, last_7_days: week.length, last_7_days_tb: week.filter((x) => x.result === 'TB').length,
          today: d.filter((x) => ymd(x.time) === ymd(now)).length },
        patients: { total: s.patients.length, per_stage: Object.fromEntries(STAGES.map((st, i) => [`${i} ${st}`, s.patients.filter((p) => p.stage === i).length])) },
        datasets: { webform: s.datasets.webform.length, offline: s.datasets.offline.length, primer: s.datasets.primer.length },
      };
    });

    case 'list_devices': return read(() => {
      let list = s.devices;
      if (has(a, 'status')) list = list.filter((d) => d.status === a.status);
      if (has(a, 'query')) { const q = String(a.query).toLowerCase(); list = list.filter((d) => [d.id, d.name, d.location, d.zone, d.city].join(' ').toLowerCase().includes(q)); }
      return { total: list.length, items: list.map((d) => devOut(d, s)) };
    });

    case 'get_device': return read(() => {
      const d = findDevice(s, a.id), det = s.detections.filter((x) => x.deviceId === d.id);
      return { ...devOut(d, s), coords: [d.lat, d.lng], tb_unreviewed: det.filter((x) => x.result === 'TB' && !x.reviewed).length,
        today: det.filter((x) => ymd(x.time) === ymd(now)).length, latest: det.slice(0, 5).map((x) => detOut(x, s)) };
    });

    case 'list_detections': return read(() => {
      const list = [...filterDetections(s, a)];
      if (a.sort === 'oldest') list.sort((x, y) => x.time - y.time);
      else if (a.sort === 'confidence') list.sort((x, y) => y.confidence - x.confidence);
      else list.sort((x, y) => y.time - x.time);
      const limit = Math.min(100, Math.max(1, Number(a.limit) || 20));
      return { total: list.length, returned: Math.min(limit, list.length), items: list.slice(0, limit).map((d) => detOut(d, s)) };
    });

    case 'get_detection': return read(() => {
      const d = s.detection(String(a.uuid)) ?? fail(`Deteksi ${a.uuid} tidak ditemukan.`);
      const pat = s.patients.find((p) => p.uuid === d.uuid);
      return { ...detOut(d, s), coughs: d.coughs, doa: d.doa, person_tracking: d.person, patient: pat ? { id: pat.id, name: pat.name, link: `/patients?open=${pat.id}` } : null };
    });

    case 'detection_stats': return read(() => {
      const list = filterDetections(s, a);
      const key = (d: Detection): string => {
        switch (a.group_by) {
          case 'device': return s.device(d.deviceId)?.name ?? `#${d.deviceId}`;
          case 'day': return ymd(d.time);
          case 'hour': return String(new Date(d.time).getHours()).padStart(2, '0') + '.00';
          case 'result': return d.result;
          case 'reviewed': return d.reviewed ? 'sudah ditinjau' : 'belum ditinjau';
          case 'verified': return d.verified ?? 'belum diverifikasi';
          default: return fail(`group_by tidak dikenal: ${a.group_by}`);
        }
      };
      const g = new Map<string, Detection[]>();
      for (const d of list) { const k = key(d); g.set(k, [...(g.get(k) || []), d]); }
      const groups = [...g.entries()].map(([k, v]) => ({ group: k, count: v.length, tb: v.filter((x) => x.result === 'TB').length, avg_confidence: +(v.reduce((t, x) => t + x.confidence, 0) / v.length).toFixed(3) }));
      groups.sort((x, y) => (a.group_by === 'day' || a.group_by === 'hour' ? x.group.localeCompare(y.group) : y.count - x.count));
      return { total: list.length, groups };
    });

    case 'list_patients': return read(() => {
      let list = s.patients;
      if (has(a, 'stage')) list = list.filter((p) => p.stage === Number(a.stage));
      if (has(a, 'facility')) list = list.filter((p) => p.facility.toLowerCase().includes(String(a.facility).toLowerCase()));
      if (has(a, 'query')) { const q = String(a.query).toLowerCase(); list = list.filter((p) => [p.name, p.id, p.facility, p.pic].join(' ').toLowerCase().includes(q)); }
      return { total: list.length, items: list.map(patOut) };
    });

    case 'get_patient': return read(() => {
      const p = findPatient(s, a.id);
      return { ...patOut(p), nik: p.nik, phone: p.phone, start: fmt.dateShort(p.start), timeline: p.events.map((e) => ({ stage: STAGES[e.stage], date: fmt.dateShort(e.t), text: e.text })) };
    });

    case 'query_dataset': return read(() => {
      const ds = String(a.dataset) as 'webform' | 'offline' | 'primer';
      let rows = (s.datasets[ds] ?? fail(`Dataset tidak dikenal: ${a.dataset}`)) as unknown as Args[];
      for (const [k, v] of Object.entries(clean(a.where as Args))) rows = rows.filter((r) => String(r[k]).toLowerCase() === String(v).toLowerCase());
      const metrics: Args = {};
      if (ds === 'webform') metrics.tb_rate = fmt.pct(rows.filter((r) => r.result === 'TB').length / Math.max(1, rows.length));
      if (ds === 'offline') metrics.accuracy = fmt.pct(rows.filter((r) => r.label === r.pred).length / Math.max(1, rows.length));
      if (ds === 'primer') { const pos = rows.filter((r) => r.lab === 'Positif'); metrics.recall = fmt.pct(pos.filter((r) => r.pred === 'TB').length / Math.max(1, pos.length)); }
      let groups: Record<string, number> | undefined;
      if (has(a, 'group_by')) { groups = {}; for (const r of rows) { const k = String(r[String(a.group_by)]); groups[k] = (groups[k] || 0) + 1; } }
      const limit = Math.min(50, Number(a.limit) || 10);
      return { total: rows.length, metrics, groups, sample: rows.slice(0, limit).map((r) => ({ ...r, time: fmt.dateShort(r.time as number) })), link: `/data/${ds}` };
    });

    // ---------- tulis ----------
    case 'add_device': {
      const id = has(a, 'id') ? Number(a.id) : Math.max(0, ...s.devices.map((d) => d.id)) + 1;
      if (!Number.isInteger(id) || id <= 0) fail('Device ID harus angka bulat positif.');
      if (s.device(id)) fail(`Device ID ${id} sudah dipakai ${s.device(id)!.name}.`);
      if (!has(a, 'name') || !has(a, 'location')) fail('name dan location wajib diisi.');
      const d: Device = {
        id, name: '', type: 'cough', status: 'active', location: '', zone: '-', city: 'Surabaya', mics: 4, array: 'ReSpeaker 4-Mic Circular',
        camera: 'USB Cam 1080p', fw: 'v1.3.2', installed: ymd(now), lastSeen: now, lat: -7.27, lng: 112.77, ...devicePatch(a),
      };
      return { confirm: null, run: () => { s.addDevice(d); return { ok: true, created: devOut(d, s) }; } };
    }

    case 'update_device': {
      const d = findDevice(s, a.id), patch = devicePatch(a.patch as Args);
      if (!Object.keys(patch).length) fail('patch kosong.');
      return { confirm: null, run: () => { s.updateDevice(d.id, patch); return { ok: true, updated: devOut({ ...d, ...patch }, s) }; } };
    }

    case 'delete_device': {
      const d = findDevice(s, a.id);
      return { confirm: ask(`Hapus perangkat **${d.name}** (#${d.id}, ${d.location})?`), run: () => { s.removeDevice(d.id); return { ok: true, deleted: d.id }; } };
    }

    case 'update_detections': {
      const uuids = [...new Set((a.uuids as string[]) || [])];
      if (!uuids.length) fail('uuids kosong.');
      if (uuids.length > 200) fail('Maksimal 200 deteksi per panggilan.');
      const missing = uuids.filter((u) => !s.detection(u));
      if (missing.length) fail(`UUID tidak ditemukan: ${missing.slice(0, 5).join(', ')}`);
      const p = (a.patch || {}) as Args, patch: Partial<Detection> = {};
      if (has(p, 'reviewed')) patch.reviewed = !!p.reviewed;
      if ('verified' in p) patch.verified = (p.verified as 'TB' | 'NEG' | null) ?? null;
      if (has(p, 'name')) patch.name = String(p.name);
      if ('gender' in p && p.gender !== null) patch.gender = p.gender as Detection['gender'];
      if (has(p, 'age')) patch.age = Number(p.age);
      if (has(p, 'type')) patch.type = p.type as Detection['type'];
      if (!Object.keys(patch).length) fail('patch kosong.');
      const what = Object.entries(patch).map(([k, v]) => `${k} = ${v === null ? 'kosong' : v}`).join(', ');
      return {
        confirm: uuids.length > 1 ? ask(`Ubah **${plural(uuids.length, 'deteksi')}** (${what})?`) : null,
        run: () => { uuids.forEach((u) => s.updateDetection(u, patch)); return { ok: true, updated: uuids.length, patch }; },
      };
    }

    case 'delete_detections': {
      const uuids = [...new Set((a.uuids as string[]) || [])].filter((u) => s.detection(u));
      if (!uuids.length) fail('Tidak ada UUID valid.');
      return { confirm: ask(`Hapus **${plural(uuids.length, 'deteksi')}** secara permanen?`), run: () => { s.removeDetections(uuids); return { ok: true, deleted: uuids.length }; } };
    }

    case 'add_patient': {
      if (!has(a, 'name')) fail('name wajib diisi.');
      if (a.gender !== 'L' && a.gender !== 'P') fail('gender harus L atau P.');
      const det = has(a, 'detection_uuid') ? s.detection(String(a.detection_uuid)) ?? fail(`Deteksi ${a.detection_uuid} tidak ditemukan.`) : undefined;
      const next = Math.max(2599, ...s.patients.map((p) => Number(p.id.replace(/\D/g, '')) || 0)) + 1;
      const p: Patient = {
        id: 'PSN-' + next, name: String(a.name).trim(), gender: a.gender as 'L' | 'P', age: has(a, 'age') ? Number(a.age) : '–', nik: has(a, 'nik') ? String(a.nik) : '–',
        phone: has(a, 'phone') ? String(a.phone) : '', facility: has(a, 'facility') ? String(a.facility) : 'RSKI Universitas Airlangga',
        stage: 0, start: now, daysIn: 0, uuid: det?.uuid ?? '—', deviceId: det?.deviceId, adherence: null, nextVisit: now + 3 * DAY,
        pic: has(a, 'pic') ? String(a.pic) : 'Belum ditentukan',
        events: [{ stage: 0, t: now, text: 'Didaftarkan ke pelacakan oleh agen' + (det ? ' dari deteksi ' + det.uuid : '') }],
      };
      return { confirm: null, run: () => { s.addPatient(p); return { ok: true, created: patOut(p) }; } };
    }

    case 'update_patient': {
      const p = findPatient(s, a.id), q = (a.patch || {}) as Args, patch: Partial<Patient> = {};
      const events = [...p.events];
      if (has(q, 'stage')) {
        const st = Number(q.stage);
        if (!(st >= 0 && st <= 4)) fail('stage harus 0-4.');
        if (st !== p.stage) { patch.stage = st; events.push({ stage: st, t: now, text: `Tahap diperbarui ke ${STAGES[st]}` }); if (st === 4) patch.nextVisit = null; }
      }
      if (has(q, 'adherence')) patch.adherence = Math.max(0, Math.min(100, Number(q.adherence)));
      if (has(q, 'next_visit')) patch.nextVisit = parseDate(String(q.next_visit));
      for (const k of ['pic', 'facility', 'phone', 'name'] as const) if (has(q, k)) patch[k] = String(q[k]);
      if (has(q, 'age')) patch.age = Number(q.age);
      if (has(a, 'note')) events.push({ stage: patch.stage ?? p.stage, t: now, text: String(a.note) });
      if (events.length !== p.events.length) patch.events = events;
      if (!Object.keys(patch).length) fail('Tidak ada perubahan.');
      return { confirm: null, run: () => { s.updatePatient(p.id, patch); return { ok: true, updated: patOut({ ...p, ...patch }) }; } };
    }

    case 'delete_patient': {
      const p = findPatient(s, a.id);
      return { confirm: ask(`Hapus pasien **${p.name}** (${p.id}) dari pelacakan?`), run: () => { s.removePatient(p.id); return { ok: true, deleted: p.id }; } };
    }

    case 'navigate': {
      const path = String(a.path || '');
      if (!/^\/(dashboard|design|live-test|devices(\/new|\/\d+)?|detections\/[\w-]+|data\/(webform|offline|primer)|patients(\?open=[\w-]+)?)?$/.test(path)) fail(`Path tidak dikenal: ${path}`);
      return { confirm: null, run: () => { env.navigate(path); return { ok: true, opened: path }; } };
    }

    default: return fail(`Tool tidak dikenal: ${name}`);
  }
}

/** label singkat untuk baris langkah di UI */
export function describeTool(name: string, a: Args): string {
  const n = (x: unknown) => (Array.isArray(x) ? x.length : 0);
  switch (name) {
    case 'get_overview': return 'Membaca ringkasan sistem';
    case 'list_devices': return 'Membaca daftar perangkat' + (a.status ? ` (${a.status})` : '');
    case 'get_device': return `Membuka perangkat #${a.id}`;
    case 'list_detections': return 'Mencari deteksi batuk';
    case 'get_detection': return `Membuka deteksi ${a.uuid}`;
    case 'detection_stats': return `Menghitung statistik per ${a.group_by}`;
    case 'list_patients': return 'Membaca daftar pasien';
    case 'get_patient': return `Membuka pasien ${a.id}`;
    case 'query_dataset': return `Query dataset ${a.dataset}`;
    case 'add_device': return `Menambah perangkat ${a.name ?? ''}`;
    case 'update_device': return `Mengubah perangkat #${a.id}`;
    case 'delete_device': return `Menghapus perangkat #${a.id}`;
    case 'update_detections': return `Mengubah ${n(a.uuids)} deteksi`;
    case 'delete_detections': return `Menghapus ${n(a.uuids)} deteksi`;
    case 'add_patient': return `Mendaftarkan pasien ${a.name ?? ''}`;
    case 'update_patient': return `Mengubah pasien ${a.id}`;
    case 'delete_patient': return `Menghapus pasien ${a.id}`;
    case 'navigate': return `Membuka ${a.path}`;
    default: return name;
  }
}
