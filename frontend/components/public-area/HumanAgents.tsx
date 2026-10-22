'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DynamicDrawUsage, InstancedMesh, Matrix4, Object3D, Vector3 } from 'three';
import { agentPose, SHIRTS, SKINS, type Detection, type Vec3 } from './simulation';

const PARTS = 24;
/** Anatomical ellipsoids, articulated limbs and facial details, all in one draw call. */
export function HumanAgents({ count, detection }: { count: number; detection: Detection | null }) {
  const ref = useRef<InstancedMesh>(null);
  const scratchRef = useRef({ root: new Object3D(), part: new Object3D(), matrix: new Matrix4(), color: new Color(), a: new Vector3(), b: new Vector3(), up: new Vector3(0, 1, 0) });
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    let index = 0;
    const { root, part, matrix, color, a, b, up } = scratchRef.current;
    const oval = (p: Vec3, s: Vec3, c: string, pitch = 0) => {
      part.position.set(...p); part.scale.set(...s); part.rotation.set(pitch, 0, 0); part.updateMatrix();
      matrix.multiplyMatrices(root.matrix, part.matrix); mesh.setMatrixAt(index, matrix); mesh.setColorAt(index++, color.set(c));
    };
    const limb = (from: Vec3, to: Vec3, width: number, c: string) => {
      a.set(...from); b.set(...to); part.position.copy(a).add(b).multiplyScalar(0.5);
      b.sub(a); part.scale.set(width, b.length() * 0.5 + width * 0.35, width);
      part.quaternion.setFromUnitVectors(up, b.normalize()); part.updateMatrix();
      matrix.multiplyMatrices(root.matrix, part.matrix); mesh.setMatrixAt(index, matrix); mesh.setColorAt(index++, color.set(c));
    };
    for (let id = 0; id < count; id++) {
      const target = detection?.agent === id;
      const pose = target ? { ...agentPose(id, t), position: detection.position, yaw: detection.yaw } : agentPose(id, t);
      const { seated, walking } = pose;
      const moving = walking && !target;
      const gait = t * 3.8 + id;
      const speed = moving ? Math.abs(Math.cos(t * 0.12 + id * 0.82)) : 0;
      root.position.set(...pose.position);
      root.position.y += moving ? Math.sin(gait * 2) * 0.012 * speed : 0;
      root.rotation.set(0, pose.yaw, moving ? Math.sin(gait) * 0.012 * speed : 0);
      root.scale.setScalar(1); root.updateMatrix();
      const skin = SKINS[id % SKINS.length], shirt = SHIRTS[id % SHIRTS.length], pants = id % 2 ? '#303e49' : '#55544e';
      const hip = seated ? 0.6 : 0.91;
      const breath = Math.sin(t * 1.8 + id) * 0.009;
      const bend = target ? 0.07 + Math.sin(t * 13) * 0.025 : 0;
      const shoulder = hip + 0.48 + breath;
      oval([0, hip + 0.25, bend], [0.225, 0.32, 0.135], shirt);
      oval([0, hip + 0.02, 0], [0.2, 0.15, 0.135], pants);
      oval([0, shoulder + 0.1, bend], [0.065, 0.1, 0.065], skin);
      oval([0, shoulder + 0.25, bend + 0.025], [0.115, 0.155, 0.105], skin);
      oval([0, shoulder + 0.33, bend], [0.12, 0.09, 0.11], id % 3 ? '#342b28' : '#60544b');
      oval([0, shoulder + 0.24, bend + 0.127], [0.025, 0.034, 0.03], skin);
      for (const side of [-1, 1]) {
        oval([side * 0.048, shoulder + 0.275, bend + 0.118], [0.013, 0.009, 0.008], '#292d30');
        oval([side * 0.118, shoulder + 0.245, bend + 0.015], [0.024, 0.044, 0.026], skin);
      }
      for (const side of [-1, 1]) {
        const phase = gait + (side === 1 ? 0 : Math.PI);
        const stride = Math.sin(phase) * 0.29 * speed;
        const lift = Math.max(0, Math.cos(phase)) * 0.12 * speed;
        const ankle: Vec3 = [side * 0.11, 0.12 + lift, seated ? 0.47 : stride];
        // Two-bone leg solve: fixed thigh/shin lengths, knees bend forward rather than crossing backwards.
        const dy = hip - ankle[1], dz = ankle[2];
        const reach = Math.hypot(dy, dz);
        const kneeBend = Math.sqrt(Math.max(0, 0.43 ** 2 - (reach / 2) ** 2));
        const knee: Vec3 = seated ? [side * 0.11, 0.51, 0.43] : [side * 0.11, (hip + ankle[1]) / 2 + dz / reach * kneeBend, dz / 2 + dy / reach * kneeBend];
        limb([side * 0.11, hip, 0], knee, 0.092, pants);
        limb(knee, ankle, 0.068, pants);
        const toePitch = moving ? Math.max(0, Math.cos(phase)) * Math.sin(phase) * 0.25 * speed : 0;
        oval([ankle[0], 0.07 + lift, ankle[2] + 0.075], [0.085, 0.065, 0.16], '#29343a', toePitch);
        const armSwing = -Math.sin(phase) * 0.48 * speed;
        const elbow: Vec3 = target && side === 1 ? [0.3, shoulder - 0.23, 0.18]
          : seated ? [side * 0.28, shoulder - 0.24, 0.09]
          : [side * 0.27, shoulder - Math.cos(armSwing) * 0.27, bend + Math.sin(armSwing) * 0.27];
        const hand: Vec3 = target && side === 1 ? [0.055, shoulder + 0.09, 0.24]
          : seated ? [side * 0.16, 0.63, 0.32]
          : [side * 0.25, elbow[1] - Math.cos(armSwing + 0.18) * 0.24, elbow[2] + Math.sin(armSwing + 0.18) * 0.24];
        limb([side * 0.21, shoulder, bend], elbow, 0.073, shirt);
        limb(elbow, hand, 0.055, id % 2 ? shirt : skin);
        oval(hand, [0.045, 0.07, 0.042], skin);
      }
      oval([0, hip + 0.25, bend + 0.137], [0.013, 0.21, 0.008], id % 2 ? '#9ea8a6' : shirt);
      oval([0.1, hip + 0.39, bend + 0.128], [0.05, 0.045, 0.012], shirt);
    }
    mesh.count = index;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, -2);
  return <instancedMesh ref={ref} args={[undefined, undefined, 18 * PARTS]} frustumCulled={false} castShadow receiveShadow onUpdate={m => m.instanceMatrix.setUsage(DynamicDrawUsage)}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial roughness={0.86} /></instancedMesh>;
}
