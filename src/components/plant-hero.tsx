"use client";

import { Canvas } from "@react-three/fiber";
import { PlantBody } from "@/components/plants";
import type { FruitTone, GrowthStage } from "@/lib/types";
import type { TreeTraits } from "@/lib/tree-traits";

export default function PlantHero({
  sector,
  stage,
  tone,
  saturation,
  traits,
}: {
  sector: string;
  stage: GrowthStage;
  tone: FruitTone;
  saturation: number;
  traits?: TreeTraits;
}) {
  return (
    <Canvas
      camera={{ position: [0.55, 1.55, 3.15], fov: 38, near: 0.1, far: 20 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#d7ebf6"]} />
      <ambientLight color="#fff6e8" intensity={0.75} />
      <directionalLight position={[2.4, 4.2, 2]} intensity={1.15} color="#fff1d2" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]}>
        <circleGeometry args={[1.1, 24]} />
        <meshLambertMaterial color="#c9a36b" />
      </mesh>
      <group position={[0, -0.5, 0]}>
        <PlantBody
          sector={sector}
          stage={stage}
          tone={tone}
          saturation={saturation}
          weather="neutral"
          reduced
          traits={traits}
        />
      </group>
    </Canvas>
  );
}
