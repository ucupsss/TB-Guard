'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { SceneHtml as Html } from './SceneHtml';
import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import { degrees, mouthPosition, SENSOR, type Detection, type Vec3 } from './simulation';

export function DoaBeamCone({ detection, active }: { detection: Detection; active: boolean }) {
  const pulses = useRef<Group>(null);
  const geometry = useMemo(() => {
    const source = new Vector3(...SENSOR), mouth = new Vector3(...mouthPosition(detection));
    const delta = mouth.clone().sub(source);
    const angle = detection.azimuth * Math.PI / 180;
    const arc: Vec3[] = Array.from({ length: 41 }, (_, i) => { const a = angle * i / 40; return [SENSOR[0] + Math.sin(a) * 2, 0.035, SENSOR[2] + Math.cos(a) * 2]; });
    return { mouth, source, length: delta.length(), middle: mouth.clone().add(source).multiplyScalar(0.5), cone: new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), delta.clone().normalize()), pulse: new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), delta.normalize()), arc };
  }, [detection]);
  useFrame(({ clock }) => {
    pulses.current?.children.forEach((child, i) => {
      const progress = (clock.elapsedTime * 0.65 + i / 4) % 1;
      child.position.lerpVectors(geometry.mouth, geometry.source, progress);
      child.scale.setScalar(0.15 + progress * 0.65);
      ((child as Mesh).material as MeshBasicMaterial).opacity = (1 - progress) * 0.75;
    });
  });
  return <group visible={active}>
    <mesh position={geometry.middle} quaternion={geometry.cone}><coneGeometry args={[0.65, geometry.length, 48, 1, true]} /><meshBasicMaterial color="#38bdf8" transparent opacity={0.12} side={DoubleSide} depthWrite={false} blending={AdditiveBlending} /></mesh>
    <Line points={[SENSOR, mouthPosition(detection)]} color="#38bdf8" lineWidth={1.5} transparent opacity={0.8} />
    <group ref={pulses}>{[0, 1, 2, 3].map(i => <mesh key={i} quaternion={geometry.pulse}><torusGeometry args={[0.45, 0.014, 6, 40]} /><meshBasicMaterial color="#7dd3fc" transparent depthWrite={false} blending={AdditiveBlending} /></mesh>)}</group>
    <Line points={geometry.arc} color="#38bdf8" lineWidth={2} />
    <Line points={[[0, 0.03, -3.6], [0, 0.03, -6], [detection.position[0], 0.03, detection.position[2]]]} color="#38bdf8" lineWidth={1} transparent opacity={0.4} dashed dashSize={0.15} gapSize={0.12} />
    <mesh position={[detection.position[0], 0.025, detection.position[2]]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.63, 0.68, 64]} /><meshBasicMaterial color="#38bdf8" transparent opacity={0.9} side={DoubleSide} /></mesh>
    <Html position={[detection.position[0], 0.12, detection.position[2] + 0.9]} center style={{ pointerEvents: 'none', display: active ? undefined : 'none' }}><div className="pa-angle">AZ {degrees(detection.azimuth)} <span>EL {degrees(detection.elevation)}</span></div></Html>
  </group>;
}
