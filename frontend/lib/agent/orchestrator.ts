/* Orchestra AI: model data dan registry sub-agen untuk halaman /orchestra.
   Skenario di sini adalah SIMULASI TERSKRIP untuk demo alur orkestrasi (angka ilustratif, bukan hasil panggilan sungguhan).
   Pemanggilan tool sungguhan oleh agen chat ada di lib/agent/execute.ts dan backend Go. */
import { TOOLS, toolKind } from '@/lib/agent/tools';

export type AgentIcon = 'video' | 'activity' | 'target' | 'bar-chart' | 'gear';
export type AgentStatus = 'active' | 'standby' | 'disabled';

export interface SubAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  icon: AgentIcon;
  status: AgentStatus;
  tools: string[]; // nama tool dari tools.ts
  isCustom?: boolean;
  metrics: { totalRuns: number; successRate: number; avgLatencyMs: number };
}

export interface ExecutionStep {
  id: string;
  agentId: 'orchestrator' | string;
  title: string;
  action: string;
  toolCalled?: string;
  inputData: string;
  outputData: string;
  latencyMs: number;
  tokensUsed: number;
  status: 'pending' | 'running' | 'completed';
  targetAgentId?: string;
  skipped?: boolean; // sub-agen nonaktif: langkah dilewati
}

export interface Scenario {
  id: 'A' | 'B' | 'C';
  title: string;
  short: string;
  intent: string;
  steps: ExecutionStep[];
}

/** semua nama tool yang tersedia (sumber: tools.ts) */
export const ALL_TOOLS = TOOLS.map((t) => ({ name: t.name, kind: t.kind, description: t.description }));
const TOOL_NAMES = new Set(ALL_TOOLS.map((t) => t.name));

/** pemilik tool untuk visualisasi live: tiap tool dipetakan ke satu spesialis */
const TOOL_OWNER: Record<string, string> = {
  list_devices: 'surveillance', get_device: 'surveillance', ui_show_3d: 'surveillance', ui_filter_devices: 'surveillance',
  add_device: 'surveillance', update_device: 'surveillance', delete_device: 'surveillance',
  list_detections: 'clinical', get_detection: 'clinical', update_detections: 'clinical', delete_detections: 'clinical',
  add_detection: 'clinical', ui_open_detection: 'clinical',
  list_patients: 'patient', get_patient: 'patient', add_patient: 'patient', update_patient: 'patient', delete_patient: 'patient',
  get_overview: 'economics', detection_stats: 'economics', query_dataset: 'economics', navigate: 'economics',
};

/** spesialis yang menangani sebuah tool; sub-agen nonaktif dilewati, tanpa pemilik -> 'orchestrator' */
export function agentForTool(tool: string, agents: SubAgent[]): string {
  const usable = (id?: string) => !!id && agents.some((a) => a.id === id && a.status !== 'disabled');
  const owner = TOOL_OWNER[tool];
  if (usable(owner)) return owner;
  return agents.find((a) => a.status !== 'disabled' && a.tools.includes(tool))?.id ?? 'orchestrator';
}

/** lapisan eksekusi sebuah tool: tulis = database (backend Go), ui = aktuator browser, baca = query backend */
export function executionLayer(tool?: string): 'database' | 'actuator' | 'read' | 'none' {
  if (!tool) return 'none';
  const k = toolKind(tool);
  return k === 'write' || k === 'delete' ? 'database' : k === 'ui' ? 'actuator' : 'read';
}

export const DEFAULT_AGENTS: SubAgent[] = [
  {
    id: 'surveillance', name: 'Surveillance & IoT', role: 'Spesialis sensor ruang publik', icon: 'video', status: 'active',
    description: 'Mengolah sinyal mic array 16 kHz, estimasi arah datang suara (TDoA/DoA), pengelompokan batuk publik, dan sinkronisasi kamera.',
    systemPrompt: 'Kamu Surveillance & IoT Specialist TB Guard. Baca telemetri perangkat dan deteksi, kelompokkan batuk berdasarkan lokasi dan arah suara, lalu tunjukkan hasilnya di layar. Jangan mengubah data pasien.',
    tools: ['get_overview', 'list_devices', 'get_device', 'list_detections', 'get_detection', 'detection_stats', 'ui_show_3d', 'ui_filter_devices'],
    metrics: { totalRuns: 1284, successRate: 98.6, avgLatencyMs: 212 },
  },
  {
    id: 'clinical', name: 'Clinical Triage', role: 'Spesialis triase akustik', icon: 'activity', status: 'active',
    description: 'Ekstraksi spektrogram CWT, evaluasi MobileNetV3 akustik, asesmen risiko, dan rekomendasi alur TCM/GeneXpert.',
    systemPrompt: 'Kamu Clinical Triage Specialist TB Guard. Nilai deteksi batuk dari skor model dan konteks klinis, tandai yang perlu tinjauan, dan rekomendasikan pemeriksaan TCM/GeneXpert. Hasil skrining bukan diagnosis.',
    tools: ['list_detections', 'get_detection', 'update_detections', 'query_dataset', 'ui_open_detection'],
    metrics: { totalRuns: 904, successRate: 97.9, avgLatencyMs: 348 },
  },
  {
    id: 'patient', name: 'Patient Care & DOTS', role: 'Spesialis tindak lanjut pasien', icon: 'target', status: 'active',
    description: 'Pelacakan kontak erat, penjadwalan faskes, pemantauan kepatuhan minum obat (OAT), dan mitigasi TB resisten obat.',
    systemPrompt: 'Kamu Patient Care & DOTS Specialist TB Guard. Kelola pelacakan pasien: daftarkan, majukan tahap, dan pantau kepatuhan OAT. Minta konfirmasi sebelum menghapus data.',
    tools: ['list_patients', 'get_patient', 'add_patient', 'update_patient', 'delete_patient'],
    metrics: { totalRuns: 611, successRate: 99.1, avgLatencyMs: 187 },
  },
  {
    id: 'economics', name: 'Health Economics & Gov', role: 'Spesialis ekonomi kesehatan', icon: 'bar-chart', status: 'active',
    description: 'Analisis epidemiologi untuk Dinkes, kalkulasi penghematan beban kuratif BPJS, dan kepatuhan ESG/K3 fasilitas publik.',
    systemPrompt: 'Kamu Health Economics & Gov Specialist TB Guard. Rangkum tren insiden dan hitung dampak biaya dengan asumsi yang disebutkan jelas. Jangan menyajikan estimasi sebagai fakta.',
    tools: ['get_overview', 'detection_stats', 'query_dataset', 'navigate'],
    metrics: { totalRuns: 388, successRate: 96.4, avgLatencyMs: 301 },
  },
];

let uid = 0;
const step = (s: Omit<ExecutionStep, 'id' | 'status'>): ExecutionStep => ({ id: `st${++uid}`, status: 'pending', ...s });

export const SCENARIOS: Scenario[] = [
  {
    id: 'A', title: 'Surveilans publik ke rujukan faskes', short: 'Klaster batuk ke rujukan',
    intent: 'Analisis klaster batuk di Stasiun Bandung dan siapkan rujukan',
    steps: [
      step({ agentId: 'orchestrator', targetAgentId: 'surveillance', title: 'Urai intent dan susun DAG', action: 'Intent: analisis klaster + rujukan. Rencana: surveillance, clinical, patient, economics.', inputData: '"Analisis klaster batuk di Stasiun Bandung dan siapkan rujukan"', outputData: 'dag: [surveillance -> clinical -> patient -> economics]\nlokasi: Stasiun Bandung', latencyMs: 96, tokensUsed: 412 }),
      step({ agentId: 'surveillance', title: 'Periksa telemetri dan klaster batuk', action: 'Cek 3 perangkat, kelompokkan deteksi 24 jam terakhir per arah suara.', toolCalled: 'detection_stats', inputData: '{ group_by: "device", since_days: 1 }', outputData: '3 perangkat aktif\n4 batuk TB terpusat di Peron 2\nDoA 114 derajat, SNR 14 dB', latencyMs: 214, tokensUsed: 520 }),
      step({ agentId: 'surveillance', targetAgentId: 'clinical', title: 'Sorot lokasi di 3D', action: 'Putar kamera 3D ke Peron 2 (aktuator UI, tanpa latensi jaringan).', toolCalled: 'ui_show_3d', inputData: '{ camera: "target", trigger_cough: true }', outputData: 'ok: kamera diarahkan ke sumber batuk', latencyMs: 38, tokensUsed: 96 }),
      step({ agentId: 'clinical', title: 'Evaluasi akustik CWT', action: 'Spektrogram CWT + MobileNetV3 pada 4 batuk terklaster.', toolCalled: 'get_detection', inputData: '{ uuid: "mgqs60b3" }  + 3 deteksi terkait', outputData: 'confidence TB 91,8%\nrekomendasi: TCM GeneXpert\nstatus: perlu tinjauan nakes', latencyMs: 342, tokensUsed: 688 }),
      step({ agentId: 'patient', title: 'Siapkan draf pasien rujukan', action: 'Daftarkan draf pasien tahap Terdeteksi ke Puskesmas rujukan (tersimpan di database).', toolCalled: 'add_patient', inputData: '{ name: "Draf klaster Peron 2", stage: 0, facility: "Puskesmas rujukan" }', outputData: 'ok: pasien tercatat, audit log dibuat\nlink: /patients?open=PSN-draf', latencyMs: 188, tokensUsed: 402 }),
      step({ agentId: 'economics', title: 'Hitung dampak biaya', action: 'Estimasi pencegahan transmisi 10 orang terhadap beban BPJS (asumsi ilustratif).', toolCalled: 'query_dataset', inputData: '{ dataset: "primer", group_by: "phase" }', outputData: 'transmisi dicegah: 10 orang (asumsi)\nestimasi hemat: Rp 180 juta beban BPJS', latencyMs: 296, tokensUsed: 574 }),
    ],
  },
  {
    id: 'B', title: 'Kepatuhan pasien dan pencegahan putus berobat', short: 'Kepatuhan OAT',
    intent: 'Audit kepatuhan minum obat dan atur kunjungan untuk yang mangkir',
    steps: [
      step({ agentId: 'orchestrator', targetAgentId: 'patient', title: 'Delegasikan audit kepatuhan OAT', action: 'Intent: audit kepatuhan. Rute langsung ke Patient Care (satu agen).', inputData: '"Audit kepatuhan minum obat dan atur kunjungan untuk yang mangkir"', outputData: 'dag: [patient]\nfilter: adherence < 80', latencyMs: 71, tokensUsed: 318 }),
      step({ agentId: 'patient', title: 'Filter pasien kepatuhan di bawah 80%', action: 'Ambil pasien tahap pengobatan, saring kepatuhan di bawah 80%.', toolCalled: 'list_patients', inputData: '{ stage: 3 }', outputData: '2 pasien mangkir\nrisiko putus berobat: tinggi', latencyMs: 176, tokensUsed: 365 }),
      step({ agentId: 'patient', title: 'Susun jadwal home-visit perawat', action: 'Tulis jadwal kunjungan ke catatan pasien (tersimpan di database).', toolCalled: 'update_patient', inputData: '{ id: "PSN-2513", next_visit: "+2 hari", note: "home-visit" }', outputData: 'ok: 2 jadwal kunjungan disimpan\naudit log: update patients', latencyMs: 203, tokensUsed: 441 }),
    ],
  },
  {
    id: 'C', title: 'Brief epidemiologi mingguan Dinkes dan ROI', short: 'Brief Dinkes',
    intent: 'Susun brief epidemiologi mingguan untuk Dinkes Jawa Barat',
    steps: [
      step({ agentId: 'orchestrator', targetAgentId: 'surveillance', title: 'Agregasi data insiden mingguan', action: 'Intent: laporan eksekutif. Rencana: surveillance + economics paralel.', inputData: '"Susun brief epidemiologi mingguan untuk Dinkes Jawa Barat"', outputData: 'dag: [surveillance || economics] -> brief\nperiode: 7 hari', latencyMs: 84, tokensUsed: 356 }),
      step({ agentId: 'economics', targetAgentId: 'surveillance', title: 'Proses tren 7 hari dan draf laporan', action: 'Gabungkan tren deteksi (Surveillance) dengan estimasi biaya (Economics) menjadi draf laporan eksekutif.', toolCalled: 'detection_stats', inputData: '{ group_by: "day", since_days: 7 }', outputData: 'draf: Brief Dinkes Jawa Barat\ntren batuk TB: naik di jam sibuk\nestimasi hemat: lihat tab ROI (asumsi)', latencyMs: 318, tokensUsed: 802 }),
    ],
  },
];

/* ------------------------- registry (localStorage) ------------------------- */
const CUSTOM_KEY = 'tb_custom_agents';
const OVERRIDE_KEY = 'tb_agent_status';
const isBrowser = () => typeof window !== 'undefined';
const readJSON = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; } };
const writeJSON = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* mode privat */ } };

export function loadCustomAgents(): SubAgent[] {
  if (!isBrowser()) return [];
  const list = readJSON<SubAgent[]>(CUSTOM_KEY, []);
  return Array.isArray(list) ? list.filter((a) => a && typeof a.id === 'string' && Array.isArray(a.tools)).map((a) => ({ ...a, isCustom: true, tools: a.tools.filter((t) => TOOL_NAMES.has(t)) })) : [];
}

/** daftar lengkap: 4 bawaan (dengan status tersimpan) + agen kustom */
export function loadAgents(): SubAgent[] {
  const overrides = isBrowser() ? readJSON<Record<string, AgentStatus>>(OVERRIDE_KEY, {}) : {};
  const builtIn = DEFAULT_AGENTS.map((a) => ({ ...a, status: overrides[a.id] ?? a.status }));
  return [...builtIn, ...loadCustomAgents()];
}

export function registerCustomAgent(agent: SubAgent): SubAgent {
  const clean: SubAgent = {
    ...agent, isCustom: true, status: 'active',
    id: agent.id || `custom-${Date.now().toString(36)}`,
    tools: agent.tools.filter((t) => TOOL_NAMES.has(t)),
    metrics: agent.metrics ?? { totalRuns: 0, successRate: 100, avgLatencyMs: 0 },
  };
  writeJSON(CUSTOM_KEY, [...loadCustomAgents(), clean]);
  return clean;
}

export function toggleAgentStatus(id: string): AgentStatus {
  const agents = loadAgents(), a = agents.find((x) => x.id === id);
  if (!a) return 'disabled';
  const next: AgentStatus = a.status === 'disabled' ? 'active' : 'disabled';
  if (a.isCustom) writeJSON(CUSTOM_KEY, loadCustomAgents().map((x) => (x.id === id ? { ...x, status: next } : x)));
  else writeJSON(OVERRIDE_KEY, { ...readJSON<Record<string, AgentStatus>>(OVERRIDE_KEY, {}), [id]: next });
  return next;
}

export function deleteCustomAgent(id: string) {
  writeJSON(CUSTOM_KEY, loadCustomAgents().filter((a) => a.id !== id));
}

/* ----------------------- pembuat agen otomatis (heuristik) ----------------------- */
const TOPICS: { re: RegExp; label: string; icon: AgentIcon; tools: string[] }[] = [
  { re: /bpjs|rujuk|surat|p-?care|rekam medis|pasien|kontak|obat|oat|kepatuhan/i, label: 'Rujukan & Rekam Medis', icon: 'target', tools: ['list_patients', 'get_patient', 'add_patient', 'update_patient', 'navigate'] },
  { re: /laporan|brief|dinkes|biaya|roi|hemat|ekonomi|esg|k3/i, label: 'Pelaporan & Ekonomi', icon: 'bar-chart', tools: ['get_overview', 'detection_stats', 'query_dataset', 'navigate'] },
  { re: /kamera|3d|sensor|perangkat|mikrofon|mic|stasiun|iot|telemetri/i, label: 'Sensor & Perangkat', icon: 'video', tools: ['get_overview', 'list_devices', 'get_device', 'ui_show_3d', 'ui_filter_devices'] },
  { re: /klinis|triase|tcm|genexpert|akustik|batuk|deteksi|risiko/i, label: 'Triase Klinis', icon: 'activity', tools: ['list_detections', 'get_detection', 'query_dataset', 'ui_open_detection'] },
];

/** Mensimulasikan generator AI: membaca kebutuhan, lalu menyusun nama, prompt, dan toolset yang relevan (dijalankan lokal). */
export async function autoGenerateAgentByAi(prompt: string): Promise<SubAgent> {
  await new Promise((r) => setTimeout(r, 900));
  const text = prompt.trim();
  if (text.length < 8) throw new Error('Jelaskan kebutuhan agen minimal satu kalimat.');
  const hits = TOPICS.filter((t) => t.re.test(text));
  const picked = hits.length ? hits : [TOPICS[3]];
  const tools = Array.from(new Set(['get_overview', ...picked.flatMap((t) => t.tools)])).filter((t) => TOOL_NAMES.has(t));
  const label = picked.map((t) => t.label).slice(0, 2).join(' & ');
  const agent: SubAgent = {
    id: `custom-${Date.now().toString(36)}`,
    name: `Spesialis ${label}`,
    role: 'Dibuat otomatis dari kebutuhan',
    description: text.length > 160 ? text.slice(0, 157) + '...' : text,
    systemPrompt: `Kamu Spesialis ${label} pada TB Guard. Tugas: ${text} Gunakan hanya tool yang diizinkan, laporkan hasil nyata dari tool, dan minta konfirmasi sebelum menghapus data.`,
    icon: picked[0].icon, status: 'active', tools, isCustom: true,
    metrics: { totalRuns: 0, successRate: 100, avgLatencyMs: 0 },
  };
  return registerCustomAgent(agent);
}
