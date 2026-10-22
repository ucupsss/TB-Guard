'use client';

import { Line } from '@react-three/drei';
import { SceneHtml } from './SceneHtml';
import { SENSOR, type Detection, type Vec3 } from './simulation';

// Front-facing protractor: left 0°, forward 90°, right 180°.
export const frontDegrees = (azimuth: number) => 90 + azimuth;
const point = (degrees: number, radius: number): Vec3 => {
  const angle = (degrees - 90) * Math.PI / 180;
  return [SENSOR[0] + Math.sin(angle) * radius, 0.055, SENSOR[2] + Math.cos(angle) * radius];
};
const arcs = [1.1, 2.2, 3.3].map(radius => Array.from({ length: 65 }, (_, i) => point(i / 64 * 180, radius)));
const ticks = Array.from({ length: 37 }, (_, i) => [point(i * 5, i % 3 === 0 ? 3.05 : 3.18), point(i * 5, 3.3)]);

export function DirectionProtractor({ detection }: { detection: Detection | null }) {
  const angle = detection ? frontDegrees(detection.azimuth) : 90;
  return <group>
    {arcs.map((points, i) => <Line key={i} points={points} color="#0284c7" transparent opacity={0.35} lineWidth={1} />)}
    <Line points={ticks.flat()} segments color="#0284c7" transparent opacity={0.7} lineWidth={1.5} />
    <Line points={[point(0, 3.3), SENSOR.map((n, i) => i === 1 ? 0.055 : n) as Vec3, point(180, 3.3)]} color="#0284c7" transparent opacity={0.4} />
    {[0, 45, 90, 135, 180].map(value => <SceneHtml key={value} position={point(value, 3.65)} center zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}><span className="pa-degree-mark">{value}°</span></SceneHtml>)}
    <group visible={!!detection}>
      <Line points={[[SENSOR[0], 0.065, SENSOR[2]], point(angle, 3.3)]} color="#10b981" lineWidth={3} />
      <mesh position={point(angle, 3.3)} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.12, 24]} /><meshBasicMaterial color="#10b981" toneMapped={false} /></mesh>
    </group>
    <SceneHtml position={point(angle, 4.2)} center zIndexRange={[9, 0]} style={{ pointerEvents: 'none', display: detection ? undefined : 'none' }}><span className="pa-degree-target">{angle.toFixed(1)}° <small>SUMBER BATUK</small></span></SceneHtml>
  </group>;
}

export function DirectionRadar({ detection }: { detection: Detection }) {
  const angle = frontDegrees(detection.azimuth);
  const radians = angle * Math.PI / 180;
  const x = 100 - Math.cos(radians) * 73, y = 92 - Math.sin(radians) * 73;
  return <div className="pa-direction-radar">
    <span>SUMBER SUARA BATUK</span>
    <svg viewBox="0 0 200 108" role="img" aria-label={`Arah sumber batuk ${angle.toFixed(1)} derajat di depan alat`}>
      {[26, 50, 74].map(radius => <path key={radius} d={`M ${100 - radius} 92 A ${radius} ${radius} 0 0 1 ${100 + radius} 92`} fill="none" stroke="currentColor" opacity=".2" />)}
      {Array.from({ length: 13 }, (_, i) => { const a = i * Math.PI / 12; return <line key={i} x1={100 - Math.cos(a) * 70} y1={92 - Math.sin(a) * 70} x2={100 - Math.cos(a) * 75} y2={92 - Math.sin(a) * 75} stroke="currentColor" opacity=".4" />; })}
      <line x1="100" y1="92" x2={x} y2={y} stroke="#10b981" strokeWidth="1.5" />
      <circle cx={x} cy={y} r="8" fill="#10b981" opacity=".15" /><circle cx={x} cy={y} r="3.5" fill="#10b981" />
      <circle cx="100" cy="92" r="2" fill="currentColor" />
      <g fill="currentColor" fontSize="7" fontFamily="monospace"><text x="13" y="105">0°</text><text x="94" y="11">90°</text><text x="171" y="105">180°</text></g>
    </svg>
    <p>Terdeteksi pada <b>{angle.toFixed(1)}°</b> di depan alat</p>
  </div>;
}
