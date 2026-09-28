"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import { CanvasTexture, Object3D, PCFSoftShadowMap, SRGBColorSpace, type Group, type InstancedMesh, Vector3 } from "three";
import { PlantBody } from "@/components/plants";
import { CELL, layoutFromPositions, plotPosition, type PlotLayout } from "@/lib/plots";
import type { FruitTone, GrowthStage, WeatherRegime } from "@/lib/types";

export type ScenePlant = {
  id: string;
  plotIndex: number;
  name: string;
  ticker: string;
  sector: string;
  stage: GrowthStage;
  scale: number;
  tone: FruitTone;
  saturation: number;
  highlight: boolean;
  harvestDue: boolean;
};

const LOD_DISTANCE = 22;

function useFar(threshold: number) {
  const ref = useRef<Group>(null);
  const camera = useThree((state) => state.camera);
  const [far, setFar] = useState(false);
  const tmp = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const group = ref.current;
    if (!group) return;
    group.getWorldPosition(tmp);
    const next = camera.position.distanceTo(tmp) > threshold;
    setFar((current) => (current === next ? current : next));
  });
  return { ref, far };
}

function makeSignTexture(label: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.clearRect(0, 0, 1024, 512);
  roundRect(ctx, 36, 72, 952, 368, 72);
  ctx.fillStyle = "#f6e6c8";
  ctx.fill();
  ctx.lineWidth = 16;
  ctx.strokeStyle = "#d7b48a";
  ctx.stroke();
  ctx.fillStyle = "#5c3b24";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 168;
  const family = 'Gaegu, "Apple SD Gothic Neo", sans-serif';
  ctx.font = `700 ${size}px ${family}`;
  while (ctx.measureText(label).width > 860 && size > 64) {
    size -= 6;
    ctx.font = `700 ${size}px ${family}`;
  }
  ctx.fillText(label, 512, 268);
  return canvas;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function Signboard({ label, fontReady }: { label: string; fontReady: boolean }) {
  const texture = useMemo(() => {
    const map = new CanvasTexture(makeSignTexture(label));
    map.colorSpace = SRGBColorSpace;
    map.needsUpdate = true;
    return map;
  }, [label, fontReady]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <group position={[0, 0, 0.86]} scale={1.28}>
      <mesh position={[0, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 0.5, 7]} />
        <meshLambertMaterial color="#c49262" />
      </mesh>
      <mesh position={[0, 0.58, -0.02]} castShadow>
        <boxGeometry args={[1.12, 0.48, 0.06]} />
        <meshLambertMaterial color="#e7d3ae" />
      </mesh>
      <mesh position={[0, 0.58, 0.02]}>
        <planeGeometry args={[1.02, 0.4]} />
        <meshBasicMaterial map={texture} transparent />
      </mesh>
    </group>
  );
}

function PlotBed({ highlight, onClick }: { highlight: boolean; onClick: () => void }) {
  return (
    <group onClick={(event) => { event.stopPropagation(); onClick(); }}>
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[1.72, 0.08, 1.72]} />
        <meshLambertMaterial color="#8fbf6c" />
      </mesh>
      <mesh position={[0, 0.14, 0]} receiveShadow castShadow>
        <boxGeometry args={[1.28, 0.16, 1.28]} />
        <meshLambertMaterial color="#c9a36b" />
      </mesh>
      <mesh position={[0, 0.23, 0]} receiveShadow>
        <boxGeometry args={[1.12, 0.05, 1.12]} />
        <meshLambertMaterial color="#d7b483" />
      </mesh>
      {highlight && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.28, 0]}>
          <ringGeometry args={[0.72, 0.84, 28]} />
          <meshBasicMaterial color="#e6c27a" />
        </mesh>
      )}
      <mesh position={[0, 0.7, 0]} visible={false}>
        <boxGeometry args={[1.6, 1.3, 1.6]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

function SimplePlant({
  sector,
  stage,
  tone,
}: {
  sector: string;
  stage: GrowthStage;
  tone: FruitTone;
}) {
  if (stage === "seed") {
    return (
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.1, 8, 6]} />
        <meshLambertMaterial color="#b88858" />
      </mesh>
    );
  }
  const color = sector === "반도체" ? "#2f7d52" : sector === "필수소비재" ? "#9cba4e" : "#5f9a68";
  const low = sector === "필수소비재" || sector === "유통" || stage === "sprout";
  return (
    <group>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 0.3, 6]} />
        <meshLambertMaterial color="#c4894f" />
      </mesh>
      <mesh position={[0, low ? 0.36 : 0.7, 0]}>
        {sector === "반도체" ? (
          <coneGeometry args={[0.28, 0.5, 6]} />
        ) : (
          <sphereGeometry args={[low ? 0.2 : 0.28, 8, 6]} />
        )}
        <meshLambertMaterial color={color} />
      </mesh>
      {tone !== "none" && (
        <mesh position={[0.12, low ? 0.5 : 0.95, 0.06]}>
          <sphereGeometry args={[0.06, 6, 6]} />
          <meshLambertMaterial color={tone === "vivid" ? "#e07a55" : "#e3c4b2"} />
        </mesh>
      )}
    </group>
  );
}

function GardenPlant({
  plant,
  weather,
  reduced,
  fontReady,
  layout,
  onOpen,
  onHarvested,
}: {
  plant: ScenePlant;
  weather: WeatherRegime;
  reduced: boolean;
  fontReady: boolean;
  layout: PlotLayout;
  onOpen: (id: string) => void;
  onHarvested: (id: string) => void;
}) {
  const { ref, far } = useFar(LOD_DISTANCE);
  const harvested = useRef(false);
  const lift = useRef<Group>(null);
  const started = useRef(0);

  useFrame((state) => {
    if (!plant.harvestDue || reduced || harvested.current || !lift.current) return;
    if (!started.current) started.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - started.current;
    lift.current.position.y = t * 1.2;
    lift.current.scale.setScalar(Math.max(0.01, 1 - t / 0.85));
    if (t > 0.85 && !harvested.current) {
      harvested.current = true;
      onHarvested(plant.id);
    }
  });

  useEffect(() => {
    if (plant.harvestDue && reduced && !harvested.current) {
      harvested.current = true;
      onHarvested(plant.id);
    }
  }, [plant.harvestDue, plant.id, reduced, onHarvested]);

  return (
    <group ref={ref} position={plotPosition(plant.plotIndex, layout.cols, layout.rows)}>
      <PlotBed highlight={plant.highlight} onClick={() => onOpen(plant.id)} />
      <Signboard label={far ? plant.ticker : plant.name} fontReady={fontReady} />
      <group
        scale={plant.scale * 1.35}
        position={[0, 0.24, 0]}
        onClick={(event) => {
          event.stopPropagation();
          onOpen(plant.id);
        }}
      >
        {far ? (
          <SimplePlant sector={plant.sector} stage={plant.stage} tone={plant.tone} />
        ) : (
          <>
            <PlantBody
              sector={plant.sector}
              stage={plant.stage}
              tone="none"
              saturation={0}
              weather={weather}
              reduced={reduced}
              phase={plant.plotIndex}
              hideFruit
            />
            <group ref={lift}>
              <PlantBody
                sector={plant.sector}
                stage={plant.stage}
                tone={plant.tone}
                saturation={plant.saturation}
                weather="neutral"
                reduced
                fruitOnly
              />
            </group>
          </>
        )}
      </group>
    </group>
  );
}

function EmptyPlot({
  index,
  layout,
  onEmpty,
}: {
  index: number;
  layout: PlotLayout;
  onEmpty: (index: number) => void;
}) {
  return (
    <group position={plotPosition(index, layout.cols, layout.rows)} onClick={(event) => {
      event.stopPropagation();
      onEmpty(index);
    }}>
      <PlotBed highlight={false} onClick={() => onEmpty(index)} />
      <group position={[0, 0.42, 0]}>
        <mesh>
          <boxGeometry args={[0.22, 0.05, 0.05]} />
          <meshLambertMaterial color="#c49262" />
        </mesh>
        <mesh>
          <boxGeometry args={[0.05, 0.22, 0.05]} />
          <meshLambertMaterial color="#c49262" />
        </mesh>
      </group>
    </group>
  );
}

function Island({ radius }: { radius: number }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
        <circleGeometry args={[radius * 1.5, 40]} />
        <meshLambertMaterial color="#b7d4ea" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
        <circleGeometry args={[radius * 1.05, 36]} />
        <meshLambertMaterial color="#b7d59a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <circleGeometry args={[radius * 0.82, 32]} />
        <meshLambertMaterial color="#8fbf6c" />
      </mesh>
    </group>
  );
}

function Fence({ radius }: { radius: number }) {
  const posts = useMemo(() => {
    const spots: [number, number, number][] = [];
    const reach = radius + 1.35;
    const count = Math.max(10, Math.round(reach));
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      spots.push([Math.cos(angle) * reach, 0.28, Math.sin(angle) * reach]);
    }
    return spots;
  }, [radius]);
  return (
    <group>
      {posts.map((position, index) => (
        <mesh key={index} position={position} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 0.46, 6]} />
          <meshLambertMaterial color="#d7b48a" />
        </mesh>
      ))}
    </group>
  );
}

function Clouds({ regime, reduced }: { regime: WeatherRegime; reduced: boolean }) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (!ref.current || reduced) return;
    ref.current.position.x = Math.sin(state.clock.elapsedTime * 0.08) * 0.4;
  });
  const count = regime === "bull" ? 1 : regime === "bear" ? 4 : 3;
  return (
    <group ref={ref} position={[0, 6.2, -2]}>
      {Array.from({ length: count }, (_, index) => (
        <mesh key={index} position={[-2.4 + index * 1.6, index % 2 ? 0.3 : 0, -index]}>
          <sphereGeometry args={[0.55, 10, 8]} />
          <meshLambertMaterial color="#f7fbff" />
        </mesh>
      ))}
    </group>
  );
}

function Rain() {
  const ref = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const drops = useMemo(
    () =>
      Array.from({ length: 140 }, () => ({
        x: (Math.random() - 0.5) * 12,
        y: Math.random() * 8,
        z: (Math.random() - 0.5) * 12,
      })),
    [],
  );
  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    drops.forEach((drop, index) => {
      drop.y -= delta * 4.2;
      drop.x -= delta * 0.7;
      if (drop.y < 0) {
        drop.y = 7.4;
        drop.x = (Math.random() - 0.5) * 12;
      }
      dummy.position.set(drop.x, drop.y, drop.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, drops.length]}>
      <capsuleGeometry args={[0.015, 0.12, 2, 4]} />
      <meshBasicMaterial color="#d5e6f2" transparent opacity={0.7} />
    </instancedMesh>
  );
}

function Lights({ regime }: { regime: WeatherRegime }) {
  const sky = regime === "bull" ? "#c5e6f8" : regime === "bear" ? "#c9d8e4" : "#d7e6f0";
  return (
    <>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[sky, 18, 36]} />
      <ambientLight color="#fff6e8" intensity={regime === "bear" ? 0.8 : 0.64} />
      <hemisphereLight args={["#f7fbff", "#b7d59a", 0.42]} />
      <directionalLight
        position={[5.5, 9.5, 3.2]}
        intensity={regime === "bull" ? 1.25 : regime === "bear" ? 0.88 : 1.02}
        color={regime === "bear" ? "#e8eef3" : "#fff1d2"}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={24}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0005}
      />
      {regime === "bull" && (
        <mesh position={[5.2, 7.4, -3.5]}>
          <sphereGeometry args={[0.42, 16, 12]} />
          <meshBasicMaterial color="#ffe7b0" />
        </mesh>
      )}
    </>
  );
}

function Scene({
  plants,
  weather,
  reduced,
  onOpen,
  onEmpty,
  onHarvested,
}: {
  plants: ScenePlant[];
  weather: WeatherRegime;
  reduced: boolean;
  onOpen: (id: string) => void;
  onEmpty: (index: number) => void;
  onHarvested: (id: string) => void;
}) {
  const layout = layoutFromPositions(plants);
  const occupied = new Map(plants.map((plant) => [plant.plotIndex, plant]));
  const plots = Array.from({ length: layout.count }, (_, index) => index);
  const radius = ((Math.max(layout.cols, layout.rows) - 1) * CELL) / 2 + 1.2;
  const span = Math.max(layout.cols, layout.rows) * CELL;
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    document.fonts.load('700 64px Gaegu').finally(() => {
      if (!cancelled) setFontReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <>
      <Lights regime={weather} />
      <Island radius={radius} />
      <Fence radius={radius} />
      <Clouds regime={weather} reduced={reduced} />
      {weather === "bear" && !reduced && <Rain />}
      {plots.map((index) => {
        const plant = occupied.get(index);
        if (!plant) {
          return <EmptyPlot key={index} index={index} layout={layout} onEmpty={onEmpty} />;
        }
        return (
          <GardenPlant
            key={plant.id}
            plant={plant}
            weather={weather}
            reduced={reduced}
            fontReady={fontReady}
            layout={layout}
            onOpen={onOpen}
            onHarvested={onHarvested}
          />
        );
      })}
      <OrbitControls
        makeDefault
        enableRotate={false}
        enablePan
        enableZoom
        minDistance={4.8}
        maxDistance={Math.max(14, span * 1.15)}
        target={[0, 0.3, 0.2]}
        maxPolarAngle={0.9}
        minPolarAngle={0.9}
        screenSpacePanning
      />
    </>
  );
}

export default function GardenScene(props: {
  plants: ScenePlant[];
  weather: WeatherRegime;
  reduced: boolean;
  onOpen: (id: string) => void;
  onEmpty: (index: number) => void;
  onHarvested: (id: string) => void;
}) {
  const layout = layoutFromPositions(props.plants);
  const span = Math.max(layout.cols, layout.rows) * CELL;
  return (
    <Canvas
      shadows
      dpr={[1, 1.6]}
      camera={{
        position: [0.1, Math.max(6.8, span * 0.38), Math.max(8.6, span * 0.5)],
        fov: 42,
        near: 0.1,
        far: Math.max(60, span * 4),
      }}
      gl={{ antialias: true }}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
      onCreated={({ gl }) => {
        gl.shadowMap.type = PCFSoftShadowMap;
      }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
