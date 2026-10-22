import { Vector3 } from 'three';

export type Vec3 = [number, number, number];
export type CameraMode = 'overview' | 'sensor' | 'target' | 'free';
export const SENSOR: Vec3 = [0, 3.5, -6];
export const DURATION = 8000;
export const RISK_LEVELS = ['Tinggi', 'Sedang', 'Rendah', 'Non-TB'] as const;
export type RiskLevel = typeof RISK_LEVELS[number];
export const RISK_COLORS: Record<RiskLevel, string> = { Tinggi: '#ef4444', Sedang: '#d97706', Rendah: '#0284c7', 'Non-TB': '#10b981' };
const RISK_RANGES: Record<RiskLevel, [number, number]> = { Tinggi: [75, 99], Sedang: [40, 74], Rendah: [10, 39], 'Non-TB': [0.5, 9] };
/** Synthetic event metadata only; generated once per detection, never on render. */
export function randomRisk(): { risk: RiskLevel; riskScore: number } {
  const risk = RISK_LEVELS[Math.floor(Math.random() * RISK_LEVELS.length)];
  const [min, max] = RISK_RANGES[risk];
  return { risk, riskScore: Math.round((min + Math.random() * (max - min)) * 10) / 10 };
}
export interface Detection {
  id: number;
  agent: number;
  position: Vec3;
  yaw: number;
  seated: boolean;
  time: string;
  azimuth: number;
  elevation: number;
  risk: RiskLevel;
  riskScore: number;
}
export interface Capture { id: number; image: string; face: string }
export const SHIRTS = ['#c5b89a', '#466477', '#e2ded2', '#324b55', '#8c6250', '#67705d'];
export const SKINS = ['#bd896b', '#d6aa88', '#9c694e', '#e0b899'];

// Seated visitors align with the front row; pedestrians stay in the central aisle.
export function agentPose(id: number, time: number) {
  const seated = id < 4;
  const walking = id >= 8;
  const phase = time * 0.12 + id * 0.82;
  const position: Vec3 = seated ? [-9 + id * 1.1, 0, -2.7]
    : walking ? [Math.sin(phase) * 10, 0, 1.5 + (id % 4) * 1.5]
    : [2.5 + (id - 4) * 2.2, 0, -2 + (id % 2) * 1.4];
  const yaw = walking ? (Math.cos(phase) >= 0 ? Math.PI / 2 : -Math.PI / 2) : (id % 3 - 1) * 0.3;
  return { position, yaw, seated, walking };
}
export function mouthPosition(d: Detection): Vec3 {
  return [d.position[0] + Math.sin(d.yaw) * 0.2, d.seated ? 1.32 : 1.63, d.position[2] + Math.cos(d.yaw) * 0.2];
}
export function angles(position: Vec3, seated: boolean, yaw = 0) {
  const delta = new Vector3(...position).add(new Vector3(Math.sin(yaw) * 0.2, seated ? 1.32 : 1.63, Math.cos(yaw) * 0.2)).sub(new Vector3(...SENSOR));
  return { azimuth: Math.atan2(delta.x, delta.z) * 180 / Math.PI, elevation: Math.atan2(delta.y, Math.hypot(delta.x, delta.z)) * 180 / Math.PI };
}
export const degrees = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}°`;
