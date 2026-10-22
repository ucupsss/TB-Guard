'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { SceneHtml as Html } from './SceneHtml';
import { MeshStandardMaterial } from 'three';
import { SENSOR } from './simulation';
import { DeviceAssembly } from '@/components/design/DeviceViewer';
import { enclosure, fitInterfaces, initialProject } from '@/components/design/engineering';

// perangkat dari 3D Prototype, diperbesar supaya terbaca dari kamera aula
const DEVICE_SIZE = 0.8;

export function TbGuardSensor({ active }: { active: boolean }) {
  const led = useRef<MeshStandardMaterial>(null);
  useFrame(({ clock }) => { if (led.current) led.current.emissiveIntensity = (active ? 2.5 : 0.8) + Math.sin(clock.elapsedTime * (active ? 8 : 2)) * 0.4; });
  const project = useMemo(() => ({ ...fitInterfaces(initialProject()), oled: active ? 'Direction estimated' : 'System ready', direction: 'TARGET' }), [active]);
  const [w, h] = enclosure(project);
  const scale = DEVICE_SIZE / Math.max(w, h);
  return <group position={SENSOR}>
    <group rotation={[0.35, 0, 0]} scale={scale}><DeviceAssembly project={project} /></group>
    <mesh position={[0, h * scale / 2 + 0.05, 0]}><sphereGeometry args={[0.035, 16, 12]} /><meshStandardMaterial ref={led} color={active ? '#38bdf8' : '#10b981'} emissive={active ? '#0284c7' : '#10b981'} toneMapped={false} /></mesh>
    <Html position={[0, 0.75, 0]} center distanceFactor={18} style={{ pointerEvents: 'none' }}><div className="pa-node-label"><i /> TB-GUARD <b>401</b></div></Html>
  </group>;
}
