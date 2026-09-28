"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { type Group, type PointLight } from "three";
import type { RangeEffect } from "@/lib/range-effects";

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
      child.rotation.y = Math.sin(t * fly.speed + fly.phase) * 0.4;
      const flap = 0.4 + Math.sin(t * 14 + fly.phase) * 0.35;
      child.scale.set(1, flap, 1);
    });
  });
  return (
    <group ref={group}>
      {wings.map((fly, index) => (
        <mesh key={index} position={[fly.x, fly.y, fly.z]}>
          <sphereGeometry args={[0.07, 6, 5]} />
          <meshBasicMaterial color={index % 2 ? "#f2c6de" : "#c9e4ff"} />
        </mesh>
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

export function Flame({ effect }: { effect: RangeEffect }) {
  const group = useRef<Group>(null);
  const color = effect.fireColor === "blue" ? "#7ec8ff" : "#ff6a22";
  const hot = effect.fireColor === "blue" ? "#d7f1ff" : "#ffd36a";
  const height = 0.7 + effect.intensity * 0.9;
  useFrame((state) => {
    if (!group.current) return;
    const flicker = 0.88 + Math.sin(state.clock.elapsedTime * 11) * 0.12 * effect.intensity;
    group.current.scale.set(flicker, 0.92 + Math.sin(state.clock.elapsedTime * 7) * 0.1, flicker);
  });
  return (
    <group ref={group} position={[0, 0.55, 0]} renderOrder={2}>
      <pointLight color={color} intensity={1.8 + effect.intensity * 2.4} distance={4.5} />
      <mesh position={[0, height * 0.28, 0]}>
        <coneGeometry args={[0.22 + effect.intensity * 0.16, height, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.92} depthWrite={false} />
      </mesh>
      <mesh position={[0.08, height * 0.18, 0.04]} rotation={[0, 0, -0.25]}>
        <coneGeometry args={[0.14, height * 0.7, 5]} />
        <meshBasicMaterial color={hot} transparent opacity={0.8} depthWrite={false} />
      </mesh>
      <mesh position={[-0.1, height * 0.16, -0.03]} rotation={[0, 0, 0.28]}>
        <coneGeometry args={[0.12, height * 0.62, 5]} />
        <meshBasicMaterial color={color} transparent opacity={0.75} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.22 + effect.intensity * 0.12, 10, 8]} />
        <meshBasicMaterial color={hot} transparent opacity={0.55} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function DarkAura({ intensity }: { intensity: number }) {
  const ring = useRef<Group>(null);
  useFrame((state) => {
    if (!ring.current) return;
    ring.current.rotation.y = state.clock.elapsedTime * 0.6;
    const pulse = 0.85 + Math.sin(state.clock.elapsedTime * 2.2) * 0.08 * intensity;
    ring.current.scale.setScalar(pulse);
  });
  return (
    <group ref={ring} position={[0, 0.7, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.28, 0.28 + 0.22 * intensity, 18]} />
        <meshBasicMaterial color="#2a1638" transparent opacity={0.55 + intensity * 0.3} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.42 + 0.18 * intensity, 12, 10]} />
        <meshBasicMaterial color="#120818" transparent opacity={0.22 + intensity * 0.2} />
      </mesh>
    </group>
  );
}
