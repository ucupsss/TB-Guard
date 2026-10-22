/* Definisi tool agen (format function-calling OpenAI/Groq). Dipakai server untuk dikirim ke model
   dan client untuk label UI. Eksekusinya ada di ./execute.ts (jalan di browser, langsung ke store).
   Skema sengaja ringkas: ikut terkirim di setiap langkah, sedangkan kuota Groq gratis hanya ~7rb token input/menit. */

type Schema = Record<string, unknown>;
interface ToolDef { name: string; description: string; parameters: Schema; kind: 'read' | 'write' | 'delete' | 'ui' }

const obj = (properties: Schema, required: string[] = []): Schema => ({ type: 'object', properties, ...(required.length ? { required } : {}) });
const str = (description = '', extra: Schema = {}) => ({ type: 'string', ...(description ? { description } : {}), ...extra });
const num = (description = '', extra: Schema = {}) => ({ type: 'number', ...(description ? { description } : {}), ...extra });
const bool = () => ({ type: 'boolean' });

const STATUS = { type: 'string', enum: ['active', 'inactive', 'broken'] };
const RESULT = { type: 'string', enum: ['TB', 'NEG'] };

const devicePatch = {
  name: str('mis. "TB Guard 5"'), status: STATUS, type: str('', { enum: ['cough', 'cough+vision'] }),
  location: str('mis. "Stasiun Gubeng"'), zone: str('mis. "Peron 2"'), city: str(),
  mics: num('', { enum: [4, 6] }), camera: bool(), fw: str('mis. "v1.3.2"'), lat: num(), lng: num(),
};

export const TOOLS: ToolDef[] = [
  // ---------- baca ----------
  { name: 'get_overview', kind: 'read', parameters: obj({}),
    description: 'Ringkasan sistem: perangkat per status, deteksi (total/TB/belum ditinjau/7 hari), pasien per tahap, ukuran dataset.' },
  { name: 'list_devices', kind: 'read', parameters: obj({ status: STATUS, query: str('cari nama/lokasi/zona/kota/ID') }),
    description: 'Daftar perangkat + status, lokasi, jumlah deteksi.' },
  { name: 'get_device', kind: 'read', parameters: obj({ id: num('mis. 401') }, ['id']),
    description: 'Detail perangkat + statistik deteksinya.' },
  { name: 'list_detections', kind: 'read',
    parameters: obj({
      device_id: num(), result: RESULT, reviewed: bool(), verified: str('label nakes', { enum: ['TB', 'NEG', 'none'] }),
      type: str('', { enum: ['Batuk', '-'] }), since_days: num('N hari terakhir'), date: str('YYYY-MM-DD'),
      query: str('UUID/nama individu'), min_confidence: num('0..1'), sort: str('', { enum: ['newest', 'oldest', 'confidence'] }),
      limit: num('default 20, maks 100'),
    }),
    description: 'Cari deteksi batuk. Mengembalikan total + item (UUID, perangkat, waktu, hasil, confidence, tinjau).' },
  { name: 'get_detection', kind: 'read', parameters: obj({ uuid: str() }, ['uuid']),
    description: 'Detail deteksi termasuk DOA dan pelacakan kamera.' },
  { name: 'detection_stats', kind: 'read',
    parameters: obj({
      group_by: str('', { enum: ['device', 'day', 'hour', 'result', 'reviewed', 'verified'] }),
      device_id: num(), result: RESULT, since_days: num(),
    }, ['group_by']),
    description: 'Agregat deteksi (jumlah, TB, rata-rata confidence) per kelompok: tren, jam ramai, banding perangkat.' },
  { name: 'list_patients', kind: 'read', parameters: obj({ stage: num('0-4'), query: str('nama/ID/faskes/PIC'), facility: str() }),
    description: 'Daftar pasien pelacakan.' },
  { name: 'get_patient', kind: 'read', parameters: obj({ id: str('mis. PSN-2512') }, ['id']),
    description: 'Detail pasien + timeline.' },
  { name: 'query_dataset', kind: 'read',
    parameters: obj({
      dataset: str('', { enum: ['webform', 'offline', 'primer'] }),
      where: { type: 'object', description: 'filter sama-dengan. webform: gender,city,result. offline: gender,site,mic,label,pred,collector. primer: gender,lab,method,phase,pred' },
      group_by: str('field'), limit: num('default 10'),
    }, ['dataset']),
    description: 'Query dataset penelitian. Mengembalikan total, metrik (akurasi/recall), hitungan per grup, contoh baris.' },

  // ---------- tulis ----------
  { name: 'add_device', kind: 'write', parameters: obj({ ...devicePatch, id: num('opsional, = ID firmware') }, ['name', 'location']),
    description: 'Tambah perangkat. Default: active, cough, 4 mic, kamera, Surabaya.' },
  { name: 'update_device', kind: 'write', parameters: obj({ id: num(), patch: obj(devicePatch) }, ['id', 'patch']),
    description: 'Ubah data perangkat.' },
  { name: 'delete_device', kind: 'delete', parameters: obj({ id: num() }, ['id']),
    description: 'Hapus perangkat (deteksi lama tetap ada).' },
  { name: 'update_detections', kind: 'write',
    parameters: obj({
      uuids: { type: 'array', items: { type: 'string' }, description: 'maks 200' },
      patch: obj({
        reviewed: bool(), verified: { type: ['string', 'null'], enum: ['TB', 'NEG', null] },
        name: str(), gender: str('', { enum: ['L', 'P', ''] }), age: num(), type: str('', { enum: ['Batuk', '-'] }),
      }),
    }, ['uuids', 'patch']),
    description: 'Ubah satu/banyak deteksi: tinjau, label verifikasi, identitas.' },
  { name: 'delete_detections', kind: 'delete', parameters: obj({ uuids: { type: 'array', items: { type: 'string' } } }, ['uuids']),
    description: 'Hapus deteksi.' },
  { name: 'add_patient', kind: 'write',
    parameters: obj({
      name: str(), gender: str('', { enum: ['L', 'P'] }), age: num(), phone: str(), nik: str(),
      facility: str('mis. "Puskesmas Gubeng"'), detection_uuid: str(), pic: str('mis. "dr. Rahma (Sp.P)"'),
    }, ['name', 'gender']),
    description: 'Daftarkan pasien baru (tahap 0).' },
  { name: 'update_patient', kind: 'write',
    parameters: obj({
      id: str(),
      patch: obj({ stage: num('0-4'), adherence: num('0-100'), next_visit: str('YYYY-MM-DD'), pic: str(), facility: str(), phone: str(), name: str(), age: num() }),
      note: str('catatan timeline'),
    }, ['id']),
    description: 'Ubah pasien, majukan tahap, atau tambah catatan.' },
  { name: 'delete_patient', kind: 'delete', parameters: obj({ id: str() }, ['id']),
    description: 'Hapus pasien.' },

  // ---------- UI ----------
  { name: 'navigate', kind: 'ui',
    parameters: obj({ path: str('/ (3D Public Area), /dashboard, /design, /live-test, /devices, /devices/new, /devices/{id}, /detections/{uuid}, /data/{webform|offline|primer}, /patients, /patients?open={id}') }, ['path']),
    description: 'Buka halaman untuk pengguna.' },
];

export const TOOL_SCHEMAS = TOOLS.map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));
export const toolKind = (name: string) => TOOLS.find((t) => t.name === name)?.kind ?? 'read';
