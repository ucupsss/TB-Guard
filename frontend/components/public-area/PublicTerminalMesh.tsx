'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { MeshReflectorMaterial } from '@react-three/drei';
import { SceneHtml as Html } from './SceneHtml';
import { Color, InstancedMesh, Object3D } from 'three';
import type { Vec3 } from './simulation';

interface Block { p: Vec3; s: Vec3; color: string }
function architecture() {
  const blocks: Block[] = [];
  const add = (p: Vec3, s: Vec3, color: string) => blocks.push({ p, s, color });
  // Repeated architecture and furniture share one instanced draw call.
  for (let x = -15; x <= 15; x += 3) {
    add([x, 3.2, -9.8], [0.08, 6.4, 0.12], '#657b89');
    add([x, 6.4, 0], [0.12, 0.24, 20], '#b4c0c5');
    add([x, 6.25, 0], [0.035, 0.035, 14], '#f4f6e9');
  }
  for (const z of [-9.8, 9.8]) add([0, 6.4, z], [30, 0.35, 0.25], '#aab9bd');
  for (const y of [0.3, 3.2, 6.3]) add([0, y, -9.8], [30, 0.06, 0.12], '#718b9a');
  for (const x of [-12, 12]) for (const z of [-6, 6]) {
    add([x, 3.2, z], [0.5, 6.4, 0.5], '#d4d4cb');
    add([x, 0.14, z], [0.7, 0.28, 0.7], '#647b82');
  }
  for (const row of [-3, -6.5]) for (const side of [-1, 1]) {
    const start = side < 0 ? -9 : 5;
    add([start + 1.65, 0.38, row], [4.5, 0.1, 0.12], '#809298');
    for (let i = 0; i < 4; i++) {
      const x = start + i * 1.1;
      add([x, 0.48, row], [0.88, 0.12, 0.66], '#355362');
      add([x, 0.92, row - 0.3], [0.88, 0.78, 0.09], '#355362');
      for (const dx of [-0.48, 0.48]) add([x + dx, 0.72, row], [0.045, 0.08, 0.65], '#aebfc2');
      if (i % 2 === 0) add([x, 0.22, row], [0.1, 0.44, 0.48], '#aebfc2');
    }
  }
  for (let x = -14; x < 15; x += 2) add([x, 0.004, 0], [0.012, 0.008, 20], '#adb9ba');
  for (let z = -8; z < 10; z += 2) add([0, 0.004, z], [30, 0.008, 0.012], '#adb9ba');
  add([0, 0.01, 6.5], [29, 0.012, 0.09], '#bca573');
  add([0, 0.01, 6.7], [29, 0.012, 0.035], '#bca573');
  add([0, 3.45, -6.65], [0.12, 0.12, 1.3], '#7c929d');
  add([0, 1.75, -7.3], [0.14, 3.5, 0.14], '#7c929d');
  return blocks;
}

export function PublicTerminalMesh({ dark }: { dark: boolean }) {
  const mesh = useRef<InstancedMesh>(null);
  const blocks = useMemo(() => architecture(), []);
  useLayoutEffect(() => {
    const object = new Object3D();
    blocks.forEach((b, i) => { object.position.set(...b.p); object.scale.set(...b.s); object.updateMatrix(); mesh.current!.setMatrixAt(i, object.matrix); mesh.current!.setColorAt(i, new Color(b.color)); });
    mesh.current!.instanceMatrix.needsUpdate = true;
    mesh.current!.computeBoundingSphere();
  }, [blocks]);
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[30, 20]} />
      <MeshReflectorMaterial resolution={256} blur={[128, 64]} mixBlur={0.8} mixStrength={0.35} mirror={0.22} color={dark ? '#657e8c' : '#c6ceca'} metalness={0.16} roughness={0.34} depthScale={0.2} minDepthThreshold={0.4} maxDepthThreshold={1.4} />
    </mesh>
    <mesh position={[0, -0.22, 0]} receiveShadow><boxGeometry args={[30.3, 0.4, 20.3]} /><meshStandardMaterial color="#6a7e86" /></mesh>
    <instancedMesh ref={mesh} args={[undefined, undefined, blocks.length]} castShadow receiveShadow><boxGeometry /><meshStandardMaterial roughness={0.5} metalness={0.25} /></instancedMesh>
    <mesh position={[0, 3.2, -9.84]}><boxGeometry args={[30, 6.4, 0.04]} /><meshPhysicalMaterial color="#add9e7" transparent opacity={0.2} roughness={0.12} metalness={0.12} depthWrite={false} /></mesh>
    {/* Landscape outside the glazed facade, without external model or font requests. */}
    {[-14, -8, 1, 8, 14].map((x, i) => <mesh key={x} position={[x, 1 + i % 3, -15]}><boxGeometry args={[4, 2 + i % 3 * 2, 3]} /><meshStandardMaterial color={dark ? '#213d51' : '#b7c9cc'} /></mesh>)}
    {[-11, 11].map(x => [-8, 7].map(z => <group key={`${x}-${z}`} position={[x, 0, z]}>
      <mesh position={[0, 0.38, 0]} castShadow><cylinderGeometry args={[0.42, 0.3, 0.76, 12]} /><meshStandardMaterial color="#d1cabb" roughness={0.85} /></mesh>
      <mesh position={[0, 1.1, 0]}><cylinderGeometry args={[0.04, 0.07, 1.6, 6]} /><meshStandardMaterial color="#685c42" /></mesh>
      {Array.from({ length: 7 }, (_, i) => <mesh key={i} position={[Math.sin(i * 2.4) * 0.26, 1.4 + i * 0.09, Math.cos(i * 2.4) * 0.26]} rotation={[0.35, i, 0.4]} scale={[0.32, 0.6, 0.14]} castShadow><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color={i % 2 ? '#426753' : '#65816a'} roughness={0.85} /></mesh>)}
    </group>))}
    <group position={[-5, 4.5, -6.5]}>
      <mesh castShadow><boxGeometry args={[5.6, 0.8, 0.15]} /><meshStandardMaterial color="#173a49" /></mesh>
      <Html transform position={[0, 0, 0.09]} distanceFactor={7} style={{ pointerEvents: 'none' }}><div className="pa-sign">01—04 <span>PERON / PLATFORMS</span> →</div></Html>
    </group>
    <group position={[6.5, 4.5, -6.5]}>
      <mesh><boxGeometry args={[4.5, 0.8, 0.15]} /><meshStandardMaterial color="#173a49" /></mesh>
      <Html transform position={[0, 0, 0.09]} distanceFactor={7} style={{ pointerEvents: 'none' }}><div className="pa-sign">← <span>RUANG TUNGGU</span></div></Html>
    </group>
    {[-9, 0, 9].map(x => <group key={x}><spotLight position={[x, 6.1, 1]} intensity={dark ? 65 : 40} angle={0.8} penumbra={0.8} distance={16} color="#e0f1ff" /><mesh position={[x, 6.1, 1]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.18, 12]} /><meshBasicMaterial color="#dff3ff" /></mesh></group>)}
  </group>;
}
