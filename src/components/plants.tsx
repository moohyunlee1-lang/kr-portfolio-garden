"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { FruitTone, GrowthStage, WeatherRegime } from "@/lib/types";
import { classifyTree, type TreeTraits } from "@/lib/tree-traits";

function fruitColor(saturation: number): string {
  const t = Math.min(1, Math.max(0, saturation));
  const mix = (from: number, to: number) => Math.round(from + (to - from) * t);
  return `rgb(${mix(0xd9, 0xe0)}, ${mix(0xc8, 0x6a)}, ${mix(0xbe, 0x45)})`;
}

function fruitHeight(stage: GrowthStage, size: TreeTraits["size"]): number {
  if (stage === "seed") return 0.22;
  if (stage === "sprout") return 0.38;
  const base = size === "small" ? 0.44 : size === "large" ? 1.52 : 0.98;
  if (stage === "sapling") return base * 0.86;
  if (stage === "lush") return base * 1.06;
  return base;
}

function palette(traits: TreeTraits) {
  if (traits.tone === "dark") {
    return { trunk: "#4a3428", leaf: "#2f4a34", leaf2: "#3d5c42", leaf3: "#4a6a50" };
  }
  return { trunk: "#c4894f", leaf: "#74c46c", leaf2: "#9dd87a", leaf3: "#c5ea9a" };
}

function Mat({ color }: { color: string }) {
  return <meshLambertMaterial color={color} />;
}

function Bush({ traits }: { traits: TreeTraits }) {
  const colors = palette(traits);
  const sparse = traits.foliage === "sparse";
  const dense = traits.foliage === "dense";
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.045, 0.07, 0.18, 6]} />
        <Mat color={colors.trunk} />
      </mesh>
      <mesh position={[0, 0.3, 0]} scale={[1.2, 0.72, 1.1]}>
        <sphereGeometry args={[0.34, 12, 10]} />
        <Mat color={colors.leaf} />
      </mesh>
      {!sparse && (
        <mesh position={[-0.24, 0.24, 0.1]}>
          <sphereGeometry args={[0.17, 10, 8]} />
          <Mat color={colors.leaf2} />
        </mesh>
      )}
      {dense && (
        <>
          <mesh position={[0.22, 0.26, -0.08]}>
            <sphereGeometry args={[0.15, 10, 8]} />
            <Mat color={colors.leaf3} />
          </mesh>
          <mesh position={[0.02, 0.44, 0.04]}>
            <sphereGeometry args={[0.13, 8, 6]} />
            <Mat color={colors.leaf2} />
          </mesh>
        </>
      )}
    </group>
  );
}

function RoundCanopy({ traits }: { traits: TreeTraits }) {
  const colors = palette(traits);
  const sparse = traits.foliage === "sparse";
  const dense = traits.foliage === "dense";
  return (
    <group>
      <mesh position={[0, 0.38, 0]}>
        <cylinderGeometry args={[0.07, 0.11, 0.62, 7]} />
        <Mat color={colors.trunk} />
      </mesh>
      <mesh position={[0, 0.98, 0]}>
        <sphereGeometry args={[0.4, 14, 12]} />
        <Mat color={colors.leaf} />
      </mesh>
      {!sparse && (
        <>
          <mesh position={[-0.26, 0.82, 0.1]}>
            <sphereGeometry args={[0.22, 12, 10]} />
            <Mat color={colors.leaf2} />
          </mesh>
          <mesh position={[0.24, 0.86, -0.08]}>
            <sphereGeometry args={[0.2, 12, 10]} />
            <Mat color={colors.leaf3} />
          </mesh>
        </>
      )}
      {dense && (
        <>
          <mesh position={[0.04, 1.28, 0.04]}>
            <sphereGeometry args={[0.18, 10, 8]} />
            <Mat color={colors.leaf2} />
          </mesh>
          <mesh position={[-0.12, 1.08, -0.2]}>
            <sphereGeometry args={[0.16, 10, 8]} />
            <Mat color={colors.leaf3} />
          </mesh>
        </>
      )}
    </group>
  );
}

function Pine({ traits }: { traits: TreeTraits }) {
  const colors = palette(traits);
  const layers =
    traits.foliage === "sparse"
      ? [
          { y: 0.92, r: 0.48, h: 0.62, color: colors.leaf },
          { y: 1.32, r: 0.3, h: 0.52, color: colors.leaf2 },
        ]
      : traits.foliage === "medium"
        ? [
            { y: 0.88, r: 0.5, h: 0.58, color: colors.leaf },
            { y: 1.26, r: 0.36, h: 0.5, color: colors.leaf2 },
            { y: 1.58, r: 0.22, h: 0.42, color: colors.leaf3 },
          ]
        : [
            { y: 0.82, r: 0.54, h: 0.56, color: colors.leaf },
            { y: 1.16, r: 0.42, h: 0.5, color: colors.leaf2 },
            { y: 1.48, r: 0.3, h: 0.44, color: colors.leaf3 },
            { y: 1.78, r: 0.18, h: 0.38, color: colors.leaf2 },
          ];
  return (
    <group>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.08, 0.13, 0.84, 7]} />
        <Mat color={colors.trunk} />
      </mesh>
      {layers.map((layer, index) => (
        <mesh key={index} position={[0, layer.y, 0]}>
          <coneGeometry args={[layer.r, layer.h, 8]} />
          <Mat color={layer.color} />
        </mesh>
      ))}
    </group>
  );
}

function TraitTree({ traits }: { traits: TreeTraits }) {
  if (traits.size === "small") return <Bush traits={traits} />;
  if (traits.size === "large") return <Pine traits={traits} />;
  return <RoundCanopy traits={traits} />;
}

function Seed() {
  return (
    <group>
      <mesh position={[0, 0.08, 0]}>
        <sphereGeometry args={[0.11, 12, 10]} />
        <Mat color="#b88858" />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <sphereGeometry args={[0.045, 8, 6]} />
        <Mat color="#8fbf6a" />
      </mesh>
    </group>
  );
}

function Sprout({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.28, 6]} />
        <Mat color="#7dae62" />
      </mesh>
      <mesh position={[-0.1, 0.32, 0]} rotation={[0, 0, 0.7]}>
        <sphereGeometry args={[0.09, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.1, 0.32, 0]} rotation={[0, 0, -0.7]} scale={[1, 0.7, 0.55]}>
        <sphereGeometry args={[0.09, 10, 8]} />
        <Mat color={color} />
      </mesh>
    </group>
  );
}

function StageShape({ stage, traits }: { stage: GrowthStage; traits: TreeTraits }) {
  if (stage === "seed") return <Seed />;
  if (stage === "sprout") return <Sprout color={palette(traits).leaf} />;
  const stageScale = stage === "sapling" ? 0.78 : stage === "lush" ? 1.08 : 1;
  return (
    <group scale={stageScale}>
      <TraitTree traits={traits} />
    </group>
  );
}

function Fruits({
  tone,
  saturation,
  stage,
  size,
}: {
  tone: FruitTone;
  saturation: number;
  stage: GrowthStage;
  size: TreeTraits["size"];
}) {
  const spots = useMemo(() => {
    const height = fruitHeight(stage, size);
    return [
      [0.18, height, 0.06],
      [-0.16, height - 0.08, 0.1],
      [0.02, height + 0.1, -0.14],
    ] as [number, number, number][];
  }, [stage, size]);
  if (tone === "none") return null;
  const radius = tone === "vivid" ? 0.13 : 0.15;
  return (
    <group>
      {spots.map((position, index) => (
        <mesh key={index} position={position}>
          <sphereGeometry args={[radius, 10, 8]} />
          <meshLambertMaterial color={fruitColor(saturation)} />
        </mesh>
      ))}
      {tone === "vivid" &&
        spots.map((position, index) => (
          <mesh
            key={`gloss-${index}`}
            position={[position[0] + 0.03, position[1] + 0.03, position[2] + 0.03]}
          >
            <sphereGeometry args={[0.025, 6, 6]} />
            <meshBasicMaterial color="#ffe7d4" />
          </mesh>
        ))}
    </group>
  );
}

export function PlantBody({
  sector,
  stage,
  tone,
  saturation,
  weather,
  reduced,
  phase = 0,
  fruitOnly = false,
  hideFruit = false,
  traits,
}: {
  sector: string;
  stage: GrowthStage;
  tone: FruitTone;
  saturation: number;
  weather: WeatherRegime;
  reduced: boolean;
  phase?: number;
  fruitOnly?: boolean;
  hideFruit?: boolean;
  traits?: TreeTraits;
}) {
  const look = traits ?? classifyTree({});
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (fruitOnly) return;
    const group = ref.current;
    if (!group) return;
    const lean = weather === "bear" ? -0.07 : 0;
    if (reduced) {
      group.rotation.z = lean;
      group.rotation.x = 0;
      return;
    }
    const t = state.clock.elapsedTime;
    const amp = weather === "bear" ? 0.04 : 0.018;
    group.rotation.z = lean + Math.sin(t * 1.15 + phase) * amp;
    group.rotation.x = Math.sin(t * 0.8 + phase) * amp * 0.35;
  });

  return (
    <group ref={fruitOnly ? undefined : ref}>
      {!fruitOnly && <StageShape stage={stage} traits={look} />}
      {!hideFruit && (
        <Fruits tone={tone} saturation={saturation} stage={stage} size={look.size} />
      )}
    </group>
  );
}
