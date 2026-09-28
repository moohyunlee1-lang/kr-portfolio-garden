"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import type { Group } from "three";
import type { FruitTone, GrowthStage, WeatherRegime } from "@/lib/types";

const TRUNK = "#c4894f";
const LEAF: Record<string, string> = {
  반도체: "#2f7d52",
  IT: "#6eae78",
  자동차: "#7aa24a",
  필수소비재: "#9cba4e",
  금융: "#4e9078",
  바이오: "#7dae6a",
  화학: "#7d9a62",
  통신: "#6a9a88",
  에너지: "#c4a15a",
  철강: "#8a7d68",
  유통: "#b5a15a",
  지주: "#5f9a68",
};

function leaf(sector: string): string {
  return LEAF[sector] ?? "#5f9a68";
}

function fruitColor(saturation: number): string {
  const t = Math.min(1, Math.max(0, saturation));
  const mix = (from: number, to: number) => Math.round(from + (to - from) * t);
  return `rgb(${mix(0xd9, 0xe0)}, ${mix(0xc8, 0x6a)}, ${mix(0xbe, 0x45)})`;
}

function fruitHeight(stage: GrowthStage, sector: string): number {
  if (sector === "필수소비재" || sector === "유통") {
    return stage === "lush" ? 0.58 : 0.4;
  }
  return { seed: 0.24, sprout: 0.5, sapling: 0.78, tree: 1.18, lush: 1.42 }[stage];
}

function Mat({ color }: { color: string }) {
  return <meshLambertMaterial color={color} />;
}

function Seed() {
  return (
    <group>
      <mesh position={[0, 0.08, 0]} castShadow>
        <sphereGeometry args={[0.11, 12, 10]} />
        <Mat color="#b88858" />
      </mesh>
      <mesh position={[0, 0.16, 0]} castShadow>
        <sphereGeometry args={[0.045, 8, 6]} />
        <Mat color="#8fbf6a" />
      </mesh>
    </group>
  );
}

function Sprout({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 0.28, 6]} />
        <Mat color="#7dae62" />
      </mesh>
      <mesh position={[-0.1, 0.32, 0]} rotation={[0, 0, 0.7]} castShadow>
        <sphereGeometry args={[0.09, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.1, 0.32, 0]} rotation={[0, 0, -0.7]} scale={[1, 0.7, 0.55]} castShadow>
        <sphereGeometry args={[0.09, 10, 8]} />
        <Mat color={color} />
      </mesh>
    </group>
  );
}

function Conifer({ lush }: { lush: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.11, 0.5, 7]} />
        <Mat color={TRUNK} />
      </mesh>
      <mesh position={[0, 0.78, 0]} castShadow>
        <coneGeometry args={[0.4, 0.52, 8]} />
        <Mat color="#2f7d52" />
      </mesh>
      <mesh position={[0, 1.12, 0]} castShadow>
        <coneGeometry args={[0.3, 0.46, 8]} />
        <Mat color="#3c9462" />
      </mesh>
      <mesh position={[0, 1.4, 0]} castShadow>
        <coneGeometry args={[0.18, 0.36, 8]} />
        <Mat color="#4aa56e" />
      </mesh>
      {lush && (
        <mesh position={[0.02, 0.98, 0]} castShadow>
          <coneGeometry args={[0.34, 0.36, 8]} />
          <Mat color="#348a58" />
        </mesh>
      )}
    </group>
  );
}

function Crop({ color, lush }: { color: string; lush: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.26, 0]} scale={[1.1, 0.75, 1]} castShadow>
        <sphereGeometry args={[0.28, 12, 10]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[-0.24, 0.2, 0.06]} castShadow>
        <sphereGeometry args={[0.15, 10, 8]} />
        <Mat color="#8aaf42" />
      </mesh>
      <mesh position={[0.22, 0.18, -0.05]} castShadow>
        <sphereGeometry args={[0.13, 10, 8]} />
        <Mat color="#c4d46a" />
      </mesh>
      {lush && (
        <mesh position={[0.04, 0.4, 0.08]} castShadow>
          <sphereGeometry args={[0.12, 10, 8]} />
          <Mat color="#d5e07a" />
        </mesh>
      )}
    </group>
  );
}

function RoundTree({ color, lush }: { color: string; lush: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.36, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.1, 0.58, 7]} />
        <Mat color={TRUNK} />
      </mesh>
      <mesh position={[0, 0.92, 0]} castShadow>
        <sphereGeometry args={[0.38, 14, 12]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[-0.22, 0.78, 0.08]} castShadow>
        <sphereGeometry args={[0.2, 12, 10]} />
        <Mat color={color} />
      </mesh>
      {lush && (
        <mesh position={[0.2, 1.05, -0.05]} castShadow>
          <sphereGeometry args={[0.18, 12, 10]} />
          <Mat color={color} />
        </mesh>
      )}
    </group>
  );
}

function Oak({ lush }: { lush: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 0.48, 7]} />
        <Mat color={TRUNK} />
      </mesh>
      {[[-0.28, 0.72, 0.05], [0.26, 0.7, -0.04], [0, 0.92, 0]].map((pos, index) => (
        <mesh key={index} position={pos as [number, number, number]} castShadow>
          <sphereGeometry args={[index === 2 ? 0.3 : 0.22, 12, 10]} />
          <Mat color="#7aa24a" />
        </mesh>
      ))}
      {lush && (
        <mesh position={[0.05, 1.12, 0.08]} castShadow>
          <sphereGeometry args={[0.16, 10, 8]} />
          <Mat color="#8fb456" />
        </mesh>
      )}
    </group>
  );
}

function Column({ lush }: { lush: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.34, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 0.5, 7]} />
        <Mat color={TRUNK} />
      </mesh>
      <mesh position={[0, 0.95, 0]} scale={[0.55, 1.15, 0.55]} castShadow>
        <sphereGeometry args={[0.34, 12, 10]} />
        <Mat color="#4e9078" />
      </mesh>
      {lush && (
        <mesh position={[0, 1.35, 0]} castShadow>
          <sphereGeometry args={[0.14, 10, 8]} />
          <Mat color="#6aab90" />
        </mesh>
      )}
    </group>
  );
}

function Blossom({ lush }: { lush: boolean }) {
  return (
    <group>
      <RoundTree color="#7dae6a" lush={lush} />
      {[[0.16, 1.05, 0.16], [-0.14, 0.9, 0.18], [0.08, 0.82, -0.16]].map((pos, index) => (
        <mesh key={index} position={pos as [number, number, number]}>
          <sphereGeometry args={[0.055, 8, 6]} />
          <Mat color="#e7b4c0" />
        </mesh>
      ))}
    </group>
  );
}

function Blocky({ lush }: { lush: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 0.4, 6]} />
        <Mat color={TRUNK} />
      </mesh>
      <RoundedBox args={[0.46, 0.36, 0.46]} radius={0.08} position={[0, 0.68, 0]} castShadow>
        <Mat color="#8a7d68" />
      </RoundedBox>
      {lush && (
        <RoundedBox args={[0.28, 0.22, 0.28]} radius={0.06} position={[0.08, 0.96, 0]} castShadow>
          <Mat color="#a09078" />
        </RoundedBox>
      )}
    </group>
  );
}

function FlatTop() {
  return (
    <group>
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 0.7, 6]} />
        <Mat color={TRUNK} />
      </mesh>
      <mesh position={[0, 0.82, 0]} scale={[1.3, 0.38, 1.3]} castShadow>
        <sphereGeometry args={[0.28, 12, 8]} />
        <Mat color="#6a9a88" />
      </mesh>
    </group>
  );
}

function Species({ sector, lush }: { sector: string; lush: boolean }) {
  if (sector === "반도체") return <Conifer lush={lush} />;
  if (sector === "필수소비재" || sector === "유통") {
    return <Crop color={leaf(sector)} lush={lush} />;
  }
  if (sector === "자동차") return <Oak lush={lush} />;
  if (sector === "금융") return <Column lush={lush} />;
  if (sector === "바이오") return <Blossom lush={lush} />;
  if (sector === "철강") return <Blocky lush={lush} />;
  if (sector === "통신") return <FlatTop />;
  return <RoundTree color={leaf(sector)} lush={lush} />;
}

function StageShape({ sector, stage }: { sector: string; stage: GrowthStage }) {
  if (stage === "seed") return <Seed />;
  if (stage === "sprout") return <Sprout color={leaf(sector)} />;
  const lush = stage === "lush";
  const shapeScale = stage === "sapling" ? 0.78 : lush ? 1.12 : 1;
  return (
    <group scale={shapeScale}>
      <Species sector={sector} lush={lush} />
    </group>
  );
}

function Fruits({
  tone,
  saturation,
  stage,
  sector,
}: {
  tone: FruitTone;
  saturation: number;
  stage: GrowthStage;
  sector: string;
}) {
  const spots = useMemo(() => {
    const height = fruitHeight(stage, sector);
    return [
      [0.18, height, 0.06],
      [-0.16, height - 0.08, 0.1],
      [0.02, height + 0.1, -0.14],
    ] as [number, number, number][];
  }, [stage, sector]);
  if (tone === "none") return null;
  const radius = tone === "vivid" ? 0.13 : 0.15;
  return (
    <group>
      {spots.map((position, index) => (
        <mesh key={index} position={position} castShadow>
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
}) {
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
      {!fruitOnly && <StageShape sector={sector} stage={stage} />}
      {!hideFruit && (
        <Fruits tone={tone} saturation={saturation} stage={stage} sector={sector} />
      )}
    </group>
  );
}
