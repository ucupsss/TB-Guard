'use client';

import { Component, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { PerspectiveCamera, SRGBColorSpace, Vector3, WebGLRenderTarget } from 'three';
import { CubeIcon, VideoIcon, TargetIcon, MoveIcon, SpeakerLoudIcon, ViewHorizontalIcon, ReloadIcon } from '@radix-ui/react-icons';
import { PublicTerminalMesh } from './PublicTerminalMesh';
import { HumanAgents } from './HumanAgents';
import { TbGuardSensor } from './TbGuardSensor';
import { DoaBeamCone } from './DoaBeamCone';
import { CaptureCard, TargetHudOverlay } from './TargetHudOverlay';
import { DirectionProtractor } from './DirectionRadar';
import { useUiCommand } from '@/lib/agent/ui-bus';
import { agentPose, angles, DURATION, randomRisk, RISK_COLORS, SENSOR, type CameraMode, type Capture, type Detection } from './simulation';

const subscribeTheme = (callback: () => void) => {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
};
const MODES = [
  { id: 'overview', label: 'Overview', icon: CubeIcon },
  { id: 'sensor', label: 'Sensor POV', icon: VideoIcon },
  { id: 'target', label: 'Target Close-Up', icon: TargetIcon },
  { id: 'free', label: 'Free Orbit', icon: MoveIcon },
] as const;

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="pa-fallback"><h2>Scene 3D tidak dapat dimuat</h2><p>Aktifkan akselerasi grafis browser, lalu muat ulang halaman.</p><button onClick={() => window.location.reload()}>Muat ulang</button></div> : this.props.children; }
}

function CameraRig({ mode, detection, timeRef, onInteract }: { mode: CameraMode; detection: Detection | null; timeRef: RefObject<number>; onInteract: () => void }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const scratch = useMemo(() => ({ eye: new Vector3(), target: new Vector3() }), []);
  useFrame(({ clock }, delta) => {
    timeRef.current = clock.elapsedTime;
    if (!controls.current || mode === 'free') return;
    const p = detection?.position ?? [3, 0, 2];
    const head = detection?.seated ? 1.1 : 1.5;
    if (mode === 'overview') { scratch.eye.set(24, 19, 26); scratch.target.set(0, 0, -1); }
    else if (mode === 'sensor') { scratch.eye.set(...SENSOR).add(new Vector3(0, -0.2, 0.4)); scratch.target.set(p[0], head, p[2]); }
    else { scratch.eye.set(p[0] + 3, 2.4, p[2] + 4); scratch.target.set(p[0], head - 0.3, p[2]); }
    const alpha = 1 - Math.exp(-delta * 3);
    camera.position.lerp(scratch.eye, alpha);
    controls.current.target.lerp(scratch.target, alpha);
    controls.current.update();
  });
  return <OrbitControls ref={controls} makeDefault enableDamping enablePan enableZoom screenSpacePanning minDistance={1.5} maxDistance={60} zoomSpeed={0.8} panSpeed={0.8} onStart={onInteract} maxPolarAngle={Math.PI / 2 - 0.035} target={[0, 0, -1]} />;
}

/** Render a real frame of this scene from the node, then crop the projected target. No webcam or AI claim. */
function SensorCapture({ detection, onCapture, onError }: { detection: Detection | null; onCapture: (capture: Capture) => void; onError: () => void }) {
  const last = useRef<number | null>(null);
  const { gl, scene } = useThree();
  const resources = useMemo(() => {
    const target = new WebGLRenderTarget(640, 400);
    target.texture.colorSpace = SRGBColorSpace;
    return { target, camera: new PerspectiveCamera(65, 1.6, 0.1, 100), pixels: new Uint8Array(640 * 400 * 4) };
  }, []);
  useEffect(() => () => resources.target.dispose(), [resources]);
  useFrame(() => {
    if (!detection || last.current === detection.id) return;
    last.current = detection.id;
    const previous = gl.getRenderTarget();
    try {
      const { target, camera, pixels } = resources;
      const [x, , z] = detection.position;
      const height = detection.seated ? 1.55 : 1.85;
      camera.position.set(...SENSOR).add(new Vector3(0, -0.2, 0.4));
      camera.lookAt(x, height * 0.65, z); camera.updateMatrixWorld();
      gl.setRenderTarget(target); gl.clear(); gl.render(scene, camera); gl.readRenderTargetPixels(target, 0, 0, 640, 400, pixels);
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 400;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas capture unavailable');
      const data = ctx.createImageData(640, 400);
      for (let row = 0; row < 400; row++) data.data.set(pixels.subarray((399 - row) * 640 * 4, (400 - row) * 640 * 4), row * 640 * 4);
      ctx.putImageData(data, 0, 0);
      const project = (px: number, py: number, pz: number) => { const v = new Vector3(px, py, pz).project(camera); return [(v.x + 1) * 320, (1 - v.y) * 200]; };
      const top = project(x, height, z), bottom = project(x, 0.02, z);
      const bodyHeight = Math.max(30, Math.abs(bottom[1] - top[1]));
      const width = bodyHeight * 0.48;
      // Crop before drawing the bounding box so the face thumbnail contains only scene pixels.
      const head = project(x, height - 0.2, z);
      const cropSize = Math.max(18, bodyHeight * 0.29);
      const cropX = Math.max(0, Math.min(640 - cropSize, head[0] - cropSize / 2));
      const cropY = Math.max(0, Math.min(400 - cropSize, head[1] - cropSize / 2));
      const face = document.createElement('canvas'); face.width = 96; face.height = 96;
      const faceCtx = face.getContext('2d');
      if (!faceCtx) throw new Error('Face crop unavailable');
      faceCtx.drawImage(canvas, cropX, cropY, cropSize, cropSize, 0, 0, 96, 96);
      ctx.strokeStyle = RISK_COLORS[detection.risk]; ctx.lineWidth = 2; ctx.strokeRect(top[0] - width / 2, top[1], width, bodyHeight);
      ctx.fillStyle = RISK_COLORS[detection.risk]; ctx.font = 'bold 12px monospace'; ctx.fillText(`TARGET ${detection.agent + 1} / ${detection.risk.toUpperCase()}`, Math.max(5, top[0] - width / 2), Math.max(16, top[1] - 8));
      onCapture({ id: detection.id, image: canvas.toDataURL('image/jpeg', 0.88), face: face.toDataURL('image/jpeg', 0.9) });
    } catch { onError(); } finally { gl.setRenderTarget(previous); }
  }, -1);
  return null;
}

export default function PublicAreaScene() {
  const dark = useSyncExternalStore(subscribeTheme, () => document.documentElement.classList.contains('dark'), () => false);
  const [mode, setMode] = useState<CameraMode>('overview');
  const [count, setCount] = useState(16);
  const [beam, setBeam] = useState(true);
  const [auto, setAuto] = useState(true);
  const [detection, setDetection] = useState<Detection | null>(null);
  const [latest, setLatest] = useState<Detection | null>(null);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [captureError, setCaptureError] = useState(false);
  const [total, setTotal] = useState(0);
  const [ready, setReady] = useState(false);
  const time = useRef(0), sequence = useRef(0);
  const trigger = useCallback(() => {
    const agent = Math.floor(Math.random() * count);
    const pose = agentPose(agent, time.current);
    const next = { id: ++sequence.current, agent, position: pose.position, yaw: pose.yaw, seated: pose.seated, time: new Date().toLocaleTimeString('id-ID', { hour12: false }), ...angles(pose.position, pose.seated, pose.yaw), ...randomRisk() };
    setDetection(next); setLatest(next); setCapture(null); setCaptureError(false); setTotal(n => n + 1);
  }, [count]);
  useEffect(() => {
    if (!auto || !ready) return;
    const first = window.setTimeout(trigger, 4500);
    const interval = window.setInterval(trigger, 18000);
    return () => { window.clearTimeout(first); window.clearInterval(interval); };
  }, [auto, ready, trigger]);
  useEffect(() => {
    if (!detection) return;
    const timer = window.setTimeout(() => setDetection(null), DURATION);
    return () => window.clearTimeout(timer);
  }, [detection]);
  // dikendalikan agen AI: pindah preset kamera dan/atau picu batuk agar langsung tersorot
  useUiCommand('3d', (c) => {
    if (c.camera) { setAuto(false); setMode(c.camera); }
    if (c.triggerCough) { setAuto(false); setMode(c.camera ?? 'target'); window.setTimeout(trigger, 350); }
  });
  const failCapture = useCallback(() => setCaptureError(true), []);
  const freeCamera = useCallback(() => setMode('free'), []);
  return <section className="pa-workspace" aria-label="Simulasi 3D deployment TB-Guard">
    <div className="pa-scene">
      <SceneBoundary><Canvas shadows dpr={[1, 1.5]} camera={{ position: [24, 19, 26], fov: 43, near: 0.1, far: 120 }} gl={{ antialias: true, alpha: false }} onCreated={() => setReady(true)} fallback={<div className="pa-fallback">Browser ini tidak mendukung WebGL. Aktifkan akselerasi grafis.</div>}>
        <color attach="background" args={[dark ? '#0d1d2c' : '#e3e9e8']} />
        <fog attach="fog" args={[dark ? '#0d1d2c' : '#e3e9e8', 38, 85]} />
        <hemisphereLight args={['#d9efff', '#7c837a', dark ? 1 : 2.2]} />
        <directionalLight position={[-10, 16, -7]} intensity={dark ? 1.8 : 3.2} color="#fff4df" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={18} shadow-camera-bottom={-18} shadow-normalBias={0.04} shadow-bias={-0.0001} />
        <PublicTerminalMesh dark={dark} />
        <HumanAgents count={count} detection={detection} />
        <TbGuardSensor active={!!detection} />
        <DirectionProtractor detection={detection} />
        {latest && <DoaBeamCone detection={latest} active={!!detection && beam} />}
        {latest && <TargetHudOverlay detection={latest} capture={capture} active={!!detection} />}
        <CameraRig mode={mode} detection={detection} timeRef={time} onInteract={freeCamera} />
        <SensorCapture detection={detection} onCapture={setCapture} onError={failCapture} />
      </Canvas></SceneBoundary>
    </div>
    <div className="pa-topline"><div className="pa-location"><span className="pa-dot" /> LIVE SIMULATION <span className="pa-muted">/ STATION HALL</span></div><span className="pa-dimensions">30 × 20 M <span>01 NODE</span></span></div>
    <nav className="pa-camera-toolbar" aria-label="Preset kamera">{MODES.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)} title={label}><Icon /><span>{label}</span></button>)}</nav>
    <div className="pa-scene-caption"><span>TB GUARD AGENT</span><h2>Dengar batuk.<br />Cegah TB.</h2><p>Agen AI pendeteksi batuk TB di ruang publik.</p></div>
    <aside className="pa-evidence" aria-label="Capture deteksi terakhir">
      {latest ? <CaptureCard detection={latest} capture={capture} /> : <div className="pa-standby"><VideoIcon /><span>CAM 01 <b>STANDBY</b></span><p>Snapshot otomatis saat batuk terdeteksi</p><div className="pa-scan-line" /></div>}
      {captureError && <p role="alert" className="pa-error">Capture gagal. Tekan Pemicu Batuk untuk mencoba lagi.</p>}
      <div className="pa-event-count"><span>CAPTURE EVENTS</span><b>{String(total).padStart(2, '0')}</b></div>
    </aside>
    <div className="pa-controls">
      <button className="pa-trigger" onClick={trigger} disabled={!ready}><SpeakerLoudIcon /> Pemicu Batuk <span>Simulasi</span></button>
      <div className="pa-control-divider" />
      <button className="pa-toggle" aria-pressed={beam} onClick={() => setBeam(v => !v)} title="Sound Beam Overlay"><ViewHorizontalIcon /><span>Sound beam</span><i /></button>
      <label className="pa-density"><span>Pengunjung <b>{count}</b></span><input aria-label="Kepadatan pengunjung" aria-valuetext={`${count} pengunjung, ${count <= 12 ? 'sedikit' : count <= 16 ? 'sedang' : 'ramai'}`} type="range" min={12} max={18} step={2} value={count} onChange={event => { const next = Number(event.target.value); setCount(next); if (detection && detection.agent >= next) setDetection(null); }} /><span className="pa-density-labels"><small>Sedikit</small><small>Ramai</small></span></label>
      <button className="pa-auto" aria-pressed={auto} onClick={() => setAuto(v => !v)} title="Deteksi simulasi berkala"><ReloadIcon /><span>Auto {auto ? 'ON' : 'OFF'}</span></button>
    </div>
    <footer className="pa-status"><span role="status"><i className={detection ? 'detecting' : ''} />{detection ? 'Batuk terdeteksi · Target terkunci' : 'Status: Monitoring Aktif'}</span><span>{count} Pengunjung <em /> 1 Node Terhubung</span><span className="pa-demo-label">SIMULASI · AI CAPTURE</span></footer>
  </section>;
}
