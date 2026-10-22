'use client';
import Image from 'next/image';
import { Billboard, Line } from '@react-three/drei';
import { SceneHtml as Html } from './SceneHtml';
import { DirectionRadar } from './DirectionRadar';
import { degrees, RISK_COLORS, type Capture, type Detection } from './simulation';

export function CaptureCard({ detection, capture, compact = false }: { detection: Detection; capture: Capture | null; compact?: boolean }) {
  return <div className={`pa-capture ${compact ? 'pa-capture-small' : ''}`}>
    <div className="pa-capture-title"><span className="pa-dot" /> CAMERA CAPTURE <b>SIMULASI</b></div>
    {!compact && <DirectionRadar detection={detection} />}
    <div className="pa-capture-image">
      {capture?.id === detection.id ? <Image unoptimized width={640} height={400} src={capture.image} alt={`Capture kamera node: pengunjung ${detection.agent + 1} yang batuk`} /> : <div className="pa-capture-pending">Mengunci target…</div>}
      <span className="pa-capture-time">{detection.time} · CAM 01</span>
    </div>
    <div className="pa-capture-details">
      {capture?.id === detection.id && <Image unoptimized width={96} height={96} className="pa-face" src={capture.face} alt="Crop wajah target simulasi" />}
      <div><strong>Pengunjung {String(detection.agent + 1).padStart(2, '0')}</strong><small>Node #401 · Stasiun Gubeng</small></div>
    </div>
    <div className="pa-capture-score"><span>TB Risk <b style={{ color: RISK_COLORS[detection.risk] }}>{detection.riskScore.toFixed(1)}% · {detection.risk}</b></span><span>DoA <b>{degrees(detection.azimuth)}</b></span></div>
    <p className="pa-capture-note">Skor contoh simulasi · bukan hasil diagnosis</p>
  </div>;
}

export function TargetHudOverlay({ detection, capture, active }: { detection: Detection; capture: Capture | null; active: boolean }) {
  const height = detection.seated ? 1.55 : 1.85;
  return <group position={detection.position} visible={active}>
    <Billboard position={[0, height / 2, 0]}>
      {[-1, 1].flatMap(x => [-1, 1].map(y => <Line key={`${x}-${y}`} points={[[x * 0.35, y * height / 2, 0], [x * 0.52, y * height / 2, 0], [x * 0.52, y * (height / 2 - 0.18), 0]]} color={RISK_COLORS[detection.risk]} lineWidth={2.5} />))}
    </Billboard>
    <Html position={[0, height + 0.2, 0]} center style={{ pointerEvents: 'none', display: active ? undefined : 'none' }}><span className="pa-target-label">TARGET {String(detection.agent + 1).padStart(2, '0')} · LOCKED</span></Html>
    <Html position={[1.15, height + 0.45, 0]} distanceFactor={17} style={{ pointerEvents: 'none', display: active ? undefined : 'none' }} zIndexRange={[12, 0]}><div className="pa-world-card"><CaptureCard detection={detection} capture={capture} compact /></div></Html>
  </group>;
}
