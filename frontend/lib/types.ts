export type DeviceStatus = 'active' | 'inactive' | 'broken';
export interface Device {
  id: number; name: string; type: string; status: DeviceStatus; location: string; zone: string; city: string;
  mics: number; array: string; camera: string; fw: string; installed: string; lastSeen: number; lat: number; lng: number;
}
export interface Detection {
  uuid: string; deviceId: number; time: number; type: 'Batuk' | '-'; result: 'TB' | 'NEG'; confidence: number;
  name: string; gender: '' | 'L' | 'P'; age: number | '' | string;
  doa: { azimuth: number; confidence: number; snr: number; tdoa: number[] };
  person: { tracked: boolean; id: string; score: number; crowd: number };
  reviewed: boolean; coughs: number; verified?: 'TB' | 'NEG' | null;
}
export interface PatientEvent { stage: number; t: number; text: string }
export interface Patient {
  id: string; name: string; gender: 'L' | 'P'; age: number | string; nik: string; phone?: string; facility: string;
  stage: number; start: number; daysIn: number; uuid: string; deviceId?: number;
  adherence: number | null; nextVisit: number | null; pic: string; events: PatientEvent[];
}
export interface WebformRow { id: string; time: number; name: string; gender: 'L' | 'P'; age: number; city: string; weeks: number; symptoms: string[]; recordings: number; result: 'TB' | 'NEG'; confidence: number }
export interface OfflineRow { id: string; time: number; gender: 'L' | 'P'; age: number; site: string; recordings: number; mic: string; label: 'TB' | 'NEG'; pred: 'TB' | 'NEG'; collector: string }
export interface PrimerRow { id: string; time: number; gender: 'L' | 'P'; age: number; lab: 'Positif' | 'Negatif'; method: string; phase: string; recordings: number; pred: 'TB' | 'NEG'; confidence: number; facility: string }
export interface User { email: string; role: string; name: string; picture?: string }
