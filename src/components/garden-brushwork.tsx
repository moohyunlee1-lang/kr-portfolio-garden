"use client";

import { useEffect, useMemo, useRef } from "react";
import { Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, Object3D, RepeatWrapping, SRGBColorSpace, type InstancedMesh } from "three";
import { groundPigment, meadowInstances } from "@/lib/garden-brushwork";
import { meadowBladeGeometry } from '@/lib/reference-landscape';
import { DoubleSide } from 'three';
const bladeGeometry = meadowBladeGeometry();

/** One shared, mipmapped 256px texture per island, never one texture per tree. */
export function useGroundPigment(radius: number) {
  const texture = useMemo(() => {
    const map = new DataTexture(groundPigment(), 256, 256);
    map.colorSpace = SRGBColorSpace;
    map.wrapS = map.wrapT = RepeatWrapping;
    map.repeat.set(Math.max(1, radius / 5), Math.max(1, radius / 5));
    map.magFilter = LinearFilter;
    map.minFilter = LinearMipmapLinearFilter;
    map.generateMipmaps = true;
    map.needsUpdate = true;
    return map;
  }, [radius]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** Folktale-inspired meadow, two draws total, no animation or pointer interception. */
export function RimMeadow({ radius }: { radius: number }) {
  const grass = useRef<InstancedMesh>(null);
  const flowers = useRef<InstancedMesh>(null);
  const items = useMemo(() => meadowInstances(radius), [radius]);
  const buds = items.filter((p) => p.flower);
  useEffect(() => {
    if (!grass.current || !flowers.current) return;
    const dummy = new Object3D();
    const color = new Color();
    items.forEach((p, i) => {
      dummy.position.set(p.x, -0.015, p.z);
      dummy.rotation.set(0, p.angle, Math.sin(p.angle) * 0.22);
      dummy.scale.set(0.32, p.height * 1.8, 0.32);
      dummy.updateMatrix();
      grass.current!.setMatrixAt(i, dummy.matrix);
      grass.current!.setColorAt(i, color.set(["#496e53", "#8b9958", "#b1a665"][i % 3]));
    });
    items.filter((p) => p.flower).forEach((p, i) => {
      dummy.position.set(p.x, p.height, p.z);
      dummy.rotation.set(0, p.angle, 0);
      dummy.scale.set(0.07, 0.028, 0.07);
      dummy.updateMatrix();
      flowers.current!.setMatrixAt(i, dummy.matrix);
      flowers.current!.setColorAt(i, color.set(["#eee1b5", "#c3a5b4", "#d7b866"][i % 3]));
    });
    for (const mesh of [grass.current, flowers.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [items]);
  return <group name="original-rim-meadow">
    <instancedMesh name="rim-grass" ref={grass} args={[undefined, undefined, items.length]} raycast={() => {}}>
      <primitive object={bladeGeometry} attach="geometry" />
      <meshLambertMaterial side={DoubleSide} />
    </instancedMesh>
    <instancedMesh name="rim-flowers" ref={flowers} args={[undefined, undefined, buds.length]} raycast={() => {}}>
      <sphereGeometry args={[1, 5, 3]} />
      <meshLambertMaterial />
    </instancedMesh>
  </group>;
}
