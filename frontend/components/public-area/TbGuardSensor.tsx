'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { SceneHtml as Html } from './SceneHtml';
import { MeshStandardMaterial } from 'three';
import { SENSOR } from './simulation';

export function TbGuardSensor({ active }: { active: boolean }) {
  const led = useRef<MeshStandardMaterial>(null);
  useFrame(({ clock }) => { if (led.current) led.current.emissiveIntensity = (active ? 2.5 : 0.8) + Math.sin(clock.elapsedTime * (active ? 8 : 2)) * 0.4; });
  return <group position={SENSOR}>
    <group rotation={[-Math.PI / 3, 0, 0]}>
      <mesh castShadow><cylinderGeometry args={[0.32, 0.36, 0.13, 6]} /><meshStandardMaterial color="#e0e8e9" metalness={0.55} roughness={0.28} /></mesh>
      <mesh position={[0, -0.075, 0]}><cylinderGeometry args={[0.285, 0.285, 0.025, 48]} /><meshStandardMaterial color="#142e40" roughness={0.3} /></mesh>
      <mesh position={[0, -0.096, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.255, 0.012, 8, 48]} /><meshStandardMaterial ref={led} color={active ? '#38bdf8' : '#10b981'} emissive={active ? '#0284c7' : '#10b981'} toneMapped={false} /></mesh>
      <mesh position={[0, -0.108, 0]}><cylinderGeometry args={[0.092, 0.085, 0.07, 24]} /><meshStandardMaterial color="#070e18" metalness={0.75} roughness={0.12} /></mesh>
      <mesh position={[0, -0.147, 0]}><sphereGeometry args={[0.067, 24, 16]} /><meshPhysicalMaterial color="#155478" metalness={0.6} roughness={0.07} clearcoat={1} /></mesh>
      {[0, 1, 2, 3].map(i => <mesh key={i} position={[Math.sin(i * Math.PI / 2) * 0.2, -0.096, Math.cos(i * Math.PI / 2) * 0.2]}><cylinderGeometry args={[0.026, 0.026, 0.018, 12]} /><meshStandardMaterial color="#030a10" /></mesh>)}
    </group>
    <Html position={[0, 0.65, 0]} center distanceFactor={18} style={{ pointerEvents: 'none' }}><div className="pa-node-label"><i /> TB-GUARD <b>401</b></div></Html>
  </group>;
}
