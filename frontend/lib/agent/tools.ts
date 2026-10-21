/* Definisi tool agen (format function-calling OpenAI/Groq). Dipakai server untuk dikirim ke model
   dan client untuk label UI. Eksekusinya ada di ./execute.ts (jalan di browser, langsung ke store). */

type Schema = Record<string, unknown>;
interface ToolDef { name: string; description: string; parameters: Schema; kind: 'read' | 'write' | 'delete' | 'ui' }

const obj = (properties: Schema, required: string[] = []): Schema => ({ type: 'object', properties, required, additionalProperties: false });
const str = (description: string, extra: Schema = {}) => ({ type: 'string', description, ...extra });
const num = (description: string, extra: Schema = {}) => ({ type: 'number', description, ...extra });
const bool = (description: string) => ({ type: 'boolean', description });

const STATUS = { type: 'string', enum: ['active', 'inactive', 'broken'] };
const RESULT = { type: 'string', enum: ['TB', 'NEG'] };

const devicePatch = {
  name: str('Nama perangkat, mis. "TB Guard 5"'),
  status: { ...STATUS, description: 'Status perangkat' },
  type: str('Tipe perangkat', { enum: ['cough', 'cough+vision'] }),
  location: str('Lokasi pemasangan, mis. "Stasiun Gubeng"'),
  zone: str('Zona/area di lokasi, mis. "Peron 2"'),
  city: str('Kota'),
  mics: num('Jumlah mic: 4 (ReSpeaker circular) atau 6 (linear array)', { enum: [4, 6] }),
  camera: bool('Kamera terpasang?'),
  fw: str('Versi firmware, mis. "v1.3.2"'),
  lat: num('Latitude'),
  lng: num('Longitude'),
};

export const TOOLS: ToolDef[] = [
  // ---------- baca ----------
  { name: 'get_overview', kind: 'read', parameters: obj({}),
    description: 'Ringkasan seluruh sistem: jumlah perangkat per status, deteksi (total, TB, belum ditinjau, 7 hari terakhir), pasien per tahap, ukuran dataset. Panggil dulu untuk pertanyaan umum.' },
  { name: 'list_devices', kind: 'read',
    parameters: obj({ status: { ...STATUS, description: 'Filter status' }, query: str('Cari di nama/lokasi/zona/kota/ID') }),
    description: 'Daftar perangkat TB Guard beserta status, lokasi, dan jumlah deteksi.' },
  { name: 'get_device', kind: 'read', parameters: obj({ id: num('Device ID, mis. 401') }, ['id']),
    description: 'Detail satu perangkat + statistik deteksinya (total, TB, belum ditinjau, hari ini, terakhir aktif).' },
  { name: 'list_detections', kind: 'read',
    parameters: obj({
      device_id: num('Filter Device ID'),
      result: { ...RESULT, description: 'Hasil model: TB (terindikasi) atau NEG' },
      reviewed: bool('Filter sudah/belum ditinjau'),
      verified: str('Label verifikasi nakes', { enum: ['TB', 'NEG', 'none'] }),
      type: str('Jenis suara', { enum: ['Batuk', '-'] }),
      since_days: num('Hanya deteksi N hari terakhir (relatif ke waktu sistem)'),
      date: str('Hanya tanggal ini (YYYY-MM-DD)'),
      query: str('Cari di UUID atau nama individu'),
      min_confidence: num('Confidence minimum 0..1'),
      sort: str('Urutan', { enum: ['newest', 'oldest', 'confidence'] }),
      limit: num('Maks item dikembalikan (default 20, maks 100). total tetap dihitung semua.'),
    }),
    description: 'Cari deteksi batuk dengan filter. Mengembalikan total yang cocok + daftar item (UUID, perangkat, waktu, hasil, confidence, status tinjau).' },
  { name: 'get_detection', kind: 'read', parameters: obj({ uuid: str('UUID deteksi') }, ['uuid']),
    description: 'Detail lengkap satu deteksi batuk termasuk DOA (arah suara) dan pelacakan orang di kamera.' },
  { name: 'detection_stats', kind: 'read',
    parameters: obj({
      group_by: str('Kelompokkan menurut', { enum: ['device', 'day', 'hour', 'result', 'reviewed', 'verified'] }),
      device_id: num('Filter Device ID'), result: { ...RESULT, description: 'Filter hasil' }, since_days: num('N hari terakhir'),
    }, ['group_by']),
    description: 'Statistik agregat deteksi (jumlah, jumlah TB, rata-rata confidence) per kelompok. Gunakan untuk tren, jam ramai, perbandingan perangkat.' },
  { name: 'list_patients', kind: 'read',
    parameters: obj({ stage: num('Tahap 0-4: 0 Terdeteksi, 1 Skrining Lanjut, 2 Terkonfirmasi, 3 Pengobatan, 4 Sembuh'), query: str('Cari di nama/ID/faskes/PIC'), facility: str('Filter faskes') }),
    description: 'Daftar pasien di pelacakan (dari terdeteksi hingga sembuh).' },
  { name: 'get_patient', kind: 'read', parameters: obj({ id: str('ID pasien, mis. PSN-2512') }, ['id']),
    description: 'Detail pasien termasuk riwayat (timeline) tahapan.' },
  { name: 'query_dataset', kind: 'read',
    parameters: obj({
      dataset: str('Dataset penelitian', { enum: ['webform', 'offline', 'primer'] }),
      where: { type: 'object', description: 'Filter kesamaan field, mis. {"gender":"P","city":"Surabaya"}. Field webform: gender,city,result. offline: gender,site,mic,label,pred,collector. primer: gender,lab,method,phase,pred.', additionalProperties: { type: ['string', 'number'] } },
      group_by: str('Field untuk menghitung jumlah per nilai'),
      limit: num('Maks baris contoh (default 10)'),
    }, ['dataset']),
    description: 'Query dataset batuk penelitian: webform (data batuk web form), offline (naracoba offline: label vs prediksi), primer (TB primer: hasil lab vs prediksi). Mengembalikan total, metrik (akurasi/recall), hitungan per grup, dan contoh baris.' },

  // ---------- tulis ----------
  { name: 'add_device', kind: 'write',
    parameters: obj({ ...devicePatch, id: num('Device ID (opsional, default ID berikutnya). Harus sama dengan firmware.') }, ['name', 'location']),
    description: 'Mendaftarkan perangkat TB Guard baru. Wajib: name, location. Default: status active, type cough, 4 mic, kamera terpasang, kota Surabaya.' },
  { name: 'update_device', kind: 'write',
    parameters: obj({ id: num('Device ID'), patch: obj(devicePatch) }, ['id', 'patch']),
    description: 'Mengubah data perangkat (nama, status, lokasi, zona, firmware, sensor, koordinat).' },
  { name: 'delete_device', kind: 'delete', parameters: obj({ id: num('Device ID') }, ['id']),
    description: 'Menghapus perangkat. Deteksi lamanya tetap ada. Perlu persetujuan pengguna (UI meminta otomatis).' },
  { name: 'update_detections', kind: 'write',
    parameters: obj({
      uuids: { type: 'array', items: { type: 'string' }, description: 'Daftar UUID yang diubah (boleh banyak sekaligus, maks 200)' },
      patch: obj({
        reviewed: bool('Tandai sudah ditinjau'),
        verified: { type: ['string', 'null'], enum: ['TB', 'NEG', null], description: 'Label verifikasi nakes; null = belum diverifikasi' },
        name: str('Nama individu yang teridentifikasi'), gender: str('Gender', { enum: ['L', 'P', ''] }), age: num('Umur'),
        type: str('Jenis suara', { enum: ['Batuk', '-'] }),
      }),
    }, ['uuids', 'patch']),
    description: 'Mengubah satu/banyak deteksi: tandai ditinjau, beri label verifikasi, isi identitas. Untuk perubahan massal, cari dulu UUID-nya dengan list_detections (limit cukup besar).' },
  { name: 'delete_detections', kind: 'delete',
    parameters: obj({ uuids: { type: 'array', items: { type: 'string' }, description: 'UUID yang dihapus' } }, ['uuids']),
    description: 'Menghapus deteksi batuk. Perlu persetujuan pengguna.' },
  { name: 'add_patient', kind: 'write',
    parameters: obj({
      name: str('Nama lengkap'), gender: str('Gender', { enum: ['L', 'P'] }), age: num('Umur'), phone: str('No. HP'), nik: str('NIK'),
      facility: str('Faskes, mis. "RSKI Universitas Airlangga", "Puskesmas Gubeng", "Puskesmas Tambaksari", "RSUD Dr. Soetomo"'),
      detection_uuid: str('UUID deteksi asal (opsional)'), pic: str('Penanggung jawab, mis. "dr. Rahma (Sp.P)"'),
    }, ['name', 'gender']),
    description: 'Mendaftarkan pasien baru ke pelacakan (mulai tahap 0 Terdeteksi).' },
  { name: 'update_patient', kind: 'write',
    parameters: obj({
      id: str('ID pasien'),
      patch: obj({
        stage: num('Tahap baru 0-4'), adherence: num('Kepatuhan minum obat 0-100 (%)'), next_visit: str('Kunjungan berikutnya YYYY-MM-DD'),
        pic: str('Penanggung jawab'), facility: str('Faskes'), phone: str('No. HP'), name: str('Nama'), age: num('Umur'),
      }),
      note: str('Catatan untuk ditambahkan ke timeline pasien'),
    }, ['id']),
    description: 'Mengubah data pasien, memajukan tahap (otomatis menambah event timeline), atau menambah catatan.' },
  { name: 'delete_patient', kind: 'delete', parameters: obj({ id: str('ID pasien') }, ['id']),
    description: 'Menghapus pasien dari pelacakan. Perlu persetujuan pengguna.' },

  // ---------- UI ----------
  { name: 'navigate', kind: 'ui',
    parameters: obj({ path: str('Path halaman: /, /devices, /devices/new, /devices/{id}, /detections/{uuid}, /data/webform, /data/offline, /data/primer, /patients, /patients?open={id}') }, ['path']),
    description: 'Membuka halaman di aplikasi untuk pengguna. Pakai bila pengguna minta "buka", "tampilkan", atau setelah aksi agar hasilnya terlihat.' },
];

export const TOOL_SCHEMAS = TOOLS.map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));
export const toolKind = (name: string) => TOOLS.find((t) => t.name === name)?.kind ?? 'read';
