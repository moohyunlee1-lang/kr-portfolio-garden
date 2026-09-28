"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { type Group, type PointLight } from "three";
import type { RangeEffect } from "@/lib/range-effects";

function ButterflyMesh({ color }: { color: string }) {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.018, 0.07, 3, 6]} />
        <meshBasicMaterial color="#3b2a1c" />
      </mesh>
      <mesh position={[-0.09, 0.01, 0]} rotation={[0.35, 0.15, 0.55]} scale={[1, 0.12, 0.62]}>
        <sphereGeometry args={[0.11, 8, 6]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0.09, 0.01, 0]} rotation={[0.35, -0.15, -0.55]} scale={[1, 0.12, 0.62]}>
        <sphereGeometry args={[0.11, 8, 6]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

export function Butterflies({ reduced, radius }: { reduced: boolean; radius: number }) {
  const group = useRef<Group>(null);
  const wings = useMemo(
    () =>
      Array.from({ length: 10 }, (_, index) => ({
        x: Math.cos(index) * radius * 0.55,
        y: 1.4 + (index % 4) * 0.35,
        z: Math.sin(index * 1.7) * radius * 0.55,
        speed: 0.6 + (index % 3) * 0.25,
        phase: index * 0.7,
      })),
    [radius],
  );
  useFrame((state) => {
    if (!group.current || reduced) return;
    const t = state.clock.elapsedTime;
    group.current.children.forEach((child, index) => {
      const fly = wings[index];
      if (!fly) return;
      child.position.x = fly.x + Math.sin(t * fly.speed + fly.phase) * 0.8;
      child.position.y = fly.y + Math.sin(t * 1.4 + fly.phase) * 0.25;
      child.position.z = fly.z + Math.cos(t * fly.speed * 0.8 + fly.phase) * 0.8;
      child.rotation.y = Math.sin(t * fly.speed + fly.phase) * 0.9;
      const flap = 0.35 + Math.sin(t * 14 + fly.phase) * 0.45;
      const mesh = child.children[0];
      const left = mesh?.children[1];
      const right = mesh?.children[2];
      if (left) left.rotation.z = flap;
      if (right) right.rotation.z = -flap;
    });
  });
  return (
    <group ref={group}>
      {wings.map((fly, index) => (
        <group key={index} position={[fly.x, fly.y, fly.z]}>
          <ButterflyMesh color={index % 2 ? "#f2c6de" : "#c9e4ff"} />
        </group>
      ))}
    </group>
  );
}

export function Thunder({ reduced }: { reduced: boolean }) {
  const light = useRef<PointLight>(null);
  const bolt = useRef<Group>(null);
  useFrame((state) => {
    if (reduced) {
      if (light.current) light.current.intensity = 0;
      if (bolt.current) bolt.current.visible = false;
      return;
    }
    const t = state.clock.elapsedTime % 3.4;
    const on = t < 0.07 || (t > 0.12 && t < 0.18);
    if (light.current) light.current.intensity = on ? 8 : 0;
    if (bolt.current) bolt.current.visible = on;
  });
  return (
    <group>
      <pointLight ref={light} position={[0.6, 7.2, -1.4]} color="#f4fbff" intensity={0} />
      <group ref={bolt} position={[0.4, 5.6, -1.2]} visible={false}>
        <mesh position={[0, 0.9, 0]} rotation={[0, 0, 0.35]}>
          <boxGeometry args={[0.08, 1.6, 0.08]} />
          <meshBasicMaterial color="#f7fdff" />
        </mesh>
        <mesh position={[0.28, 0.05, 0]} rotation={[0, 0, -0.55]}>
          <boxGeometry args={[0.08, 1.1, 0.08]} />
          <meshBasicMaterial color="#dcefff" />
        </mesh>
        <mesh position={[0.08, -0.7, 0]} rotation={[0, 0, 0.4]}>
          <boxGeometry args={[0.07, 0.9, 0.07]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
    </group>
  );
}

export function Flame({ effect, reduced = false }: { effect: RangeEffect; reduced?: boolean }) {
  const group = useRef<Group>(null);
  const color = effect.fireColor === "blue" ? "#7ec8ff" : "#ff6a22";
  const hot = effect.fireColor === "blue" ? "#d7f1ff" : "#ffd36a";
  const height = 0.85 + effect.intensity * 1.05;
  useFrame((state) => {
    if (!group.current) return;
    if (reduced) {
      group.current.scale.set(1, 1, 1);
      return;
    }
    const flicker = 0.88 + Math.sin(state.clock.elapsedTime * 11) * 0.12 * effect.intensity;
    group.current.scale.set(flicker, 0.92 + Math.sin(state.clock.elapsedTime * 7) * 0.1, flicker);
  });
  return (
    <group ref={group} position={[0, 0.72, 0]} renderOrder={2}>
      <pointLight color={color} intensity={1.8 + effect.intensity * 2.4} distance={4.5} />
      <mesh position={[0, height * 0.32, 0]}>
        <coneGeometry args={[0.26 + effect.intensity * 0.18, height, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.92} depthWrite={false} />
      </mesh>
      <mesh position={[0.1, height * 0.2, 0.05]} rotation={[0, 0.4, -0.28]}>
        <coneGeometry args={[0.16, height * 0.72, 5]} />
        <meshBasicMaterial color={hot} transparent opacity={0.8} depthWrite={false} />
      </mesh>
      <mesh position={[-0.12, height * 0.18, -0.04]} rotation={[0, -0.3, 0.32]}>
        <coneGeometry args={[0.14, height * 0.64, 5]} />
        <meshBasicMaterial color={color} transparent opacity={0.75} depthWrite={false} />
      </mesh>
      <mesh position={[0.02, height * 0.08, 0.1]} rotation={[0.2, 0.6, 0.12]} scale={[0.55, 1, 0.35]}>
        <coneGeometry args={[0.12, height * 0.45, 5]} />
        <meshBasicMaterial color={hot} transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <sphereGeometry args={[0.24 + effect.intensity * 0.12, 10, 8]} />
        <meshBasicMaterial color={hot} transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function DarkAura({ intensity, reduced = false }: { intensity: number; reduced?: boolean }) {
  const ring = useRef<Group>(null);
  useFrame((state) => {
    if (!ring.current) return;
    if (reduced) return;
    ring.current.rotation.y = state.clock.elapsedTime * 0.6;
    const pulse = 0.85 + Math.sin(state.clock.elapsedTime * 2.2) * 0.08 * intensity;
    ring.current.scale.setScalar(pulse);
  });
  const span = 0.38 + 0.2 * intensity;
  return (
    <group ref={ring} position={[0, 0.55, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[span, span + 0.16, 22]} />
        <meshBasicMaterial color="#2a1638" transparent opacity={0.62 + intensity * 0.25} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.28, 0]}>
        <ringGeometry args={[span * 0.72, span * 0.72 + 0.1, 18]} />
        <meshBasicMaterial color="#1a0f24" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.48 + 0.16 * intensity, 12, 10]} />
        <meshBasicMaterial color="#120818" transparent opacity={0.2 + intensity * 0.18} depthWrite={false} />
      </mesh>
      {[0, 1, 2, 3].map((index) => (
        <mesh
          key={index}
          position={[
            Math.cos((index / 4) * Math.PI * 2) * 0.32,
            0.22 + (index % 2) * 0.18,
            Math.sin((index / 4) * Math.PI * 2) * 0.32,
          ]}
          scale={[0.55, 1.4, 0.55]}
        >
          <sphereGeometry args={[0.12, 8, 6]} />
          <meshBasicMaterial color="#3a2450" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
