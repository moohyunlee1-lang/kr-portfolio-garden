"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import { Box3, CanvasTexture, Object3D, Vector3, type PerspectiveCamera, SRGBColorSpace, type Group, type InstancedMesh } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { MinhwaTree } from "./minhwa-tree";
import { MinhwaClouds } from "./minhwa-clouds";
import { MinhwaLandscape } from './minhwa-landscape';
import { PlantBody, canopyPeakY } from "@/components/plants";
import { RimMeadow, useGroundPigment } from "@/components/garden-brushwork";
import { Butterflies, CrossCrownMark, DarkAura, Flame, Thunder } from "@/components/garden-fx";
import { sceneFogDistances } from "@/lib/scene-fog";
import { fitFocusBounds, focusSafeRect } from "@/lib/scene-focus";
import { islandProfile, overviewPose } from "@/lib/scene-diorama";
import type { CrossMark } from "@/lib/cross-seed";
import { CELL, layoutFromPositions, plotPosition, type PlotLayout } from "@/lib/plots";
import type { FruitTone, GrowthStage, WeatherRegime } from "@/lib/types";
import type { TreeTraits } from "@/lib/tree-traits";
import type { RangeEffect } from "@/lib/range-effects";

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
  traits: TreeTraits;
  rangeEffect: RangeEffect;
  crossMark: CrossMark | null;
};

const LOD_DISTANCE = 18;

function useSceneFar(threshold: number) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null;
  const [far, setFar] = useState(false);
  useFrame(() => {
    const next = (controls ? camera.position.distanceTo(controls.target) : camera.position.length()) > threshold;
    setFar((current) => (current === next ? current : next));
  });
  return far;
}

const SIGN_FAMILY = 'Gaegu, "Apple SD Gothic Neo", sans-serif';
const SIGN_FILL = "#3e342b";
const SIGN_HALO = "#fff8ea";
const SIGN_MAX_WIDTH = 430;
const SIGN_MIN_SIZE = 40;

function fitSignFont(ctx: CanvasRenderingContext2D, text: string, start: number, min = SIGN_MIN_SIZE) {
  let size = start;
  ctx.font = `700 ${size}px ${SIGN_FAMILY}`;
  while (ctx.measureText(text).width > SIGN_MAX_WIDTH && size > min) {
    size -= 2;
    ctx.font = `700 ${size}px ${SIGN_FAMILY}`;
  }
  while (ctx.measureText(text).width > SIGN_MAX_WIDTH && size > 24) {
    size -= 2;
    ctx.font = `700 ${size}px ${SIGN_FAMILY}`;
  }
  return size;
}

function paintGlyph(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  ctx.font = `700 ${size}px ${SIGN_FAMILY}`;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(6, Math.round(size * 0.14));
  ctx.strokeStyle = SIGN_HALO;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = SIGN_FILL;
  ctx.fillText(text, x, y);
}

function makeSignTexture(name: string, ticker: string, twoLine: boolean): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.clearRect(0, 0, 512, 256);
  roundRect(ctx, 18, 36, 476, 184, 8);
  ctx.fillStyle = "#f6e6c8";
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#69654d";
  ctx.stroke();
  ctx.fillStyle = "#a65642";
  ctx.fillRect(456, 48, 22, 24);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (twoLine) {
    const nameSize = fitSignFont(ctx, name, 56);
    const tickerSize = fitSignFont(ctx, ticker, Math.max(SIGN_MIN_SIZE, Math.min(44, nameSize - 8)));
    paintGlyph(ctx, name, 256, 112, nameSize);
    paintGlyph(ctx, ticker, 256, 162, tickerSize);
  } else {
    const size = fitSignFont(ctx, ticker, 84);
    paintGlyph(ctx, ticker, 256, 134, size);
  }
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

function Signboard({
  name,
  ticker,
  far,
  fontReady,
  onOpen,
}: {
  name: string;
  ticker: string;
  far: boolean;
  fontReady: boolean;
  onOpen: () => void;
}) {
  const texture = useMemo(() => {
    const map = new CanvasTexture(makeSignTexture(name, ticker, !far));
    map.colorSpace = SRGBColorSpace;
    map.needsUpdate = true;
    return map;
  }, [name, ticker, far, fontReady]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <group
      position={[0.48, 0, 0.58]}
      scale={0.72}
      onClick={(event) => {
        event.stopPropagation();
        if (event.delta > 2) return;
        onOpen();
      }}
    >
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.035, 0.045, 0.42, 7]} />
        <meshLambertMaterial color="#c49262" />
      </mesh>
      <mesh position={[0, 0.52, -0.02]}>
        <boxGeometry args={[0.82, 0.34, 0.05]} />
        <meshLambertMaterial color="#e7d3ae" />
      </mesh>
      <mesh position={[0, 0.52, 0.02]}>
        <planeGeometry args={[0.74, 0.28]} />
        <meshBasicMaterial map={texture} transparent />
      </mesh>
      <mesh position={[0, 0.52, -0.05]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.74, 0.28]} />
        <meshBasicMaterial map={texture} transparent />
      </mesh>
      <mesh position={[0, 0.52, 0]} visible={false}>
        <boxGeometry args={[0.9, 0.5, 0.32]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

function PlotBed({ highlight, onClick }: { highlight: boolean; onClick: () => void }) {
  return (
    <group onClick={(event) => { event.stopPropagation(); if (event.delta <= 2) onClick(); }}>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[0.75, 0.8, 0.16, 16]} />
        <meshLambertMaterial color="#69745c" />
      </mesh>
      <mesh position={[0, 0.18, 0]} receiveShadow>
        <cylinderGeometry args={[0.68, 0.74, 0.08, 16]} />
        <meshLambertMaterial color="#c5b489" />
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
  stage,
  tone,
  traits,
}: {
  stage: GrowthStage;
  tone: FruitTone;
  traits: TreeTraits;
}) {
  if(stage === "seed") return <mesh position={[0,0.12,0]}><sphereGeometry args={[0.1,8,6]} /><meshLambertMaterial color="#b88858" /></mesh>;
  return <group scale={stage==='sapling'?0.78:stage==='lush'?1.08:stage==='sprout'?0.35:1}>
    <MinhwaTree traits={traits} far />
    {tone !== "none" && <mesh position={[0.12,canopyPeakY(traits,stage),0.06]}><sphereGeometry args={[0.06,6,6]} /><meshLambertMaterial color={tone==='vivid'?'#e07a55':'#e3c4b2'} /></mesh>}
  </group>;
}

function GardenPlant({
  plant,
  weather,
  reduced,
  far,
  fontReady,
  layout,
  onOpen,
  onHarvested,
}: {
  plant: ScenePlant;
  weather: WeatherRegime;
  reduced: boolean;
  far: boolean;
  fontReady: boolean;
  layout: PlotLayout;
  onOpen: (id: string) => void;
  onHarvested: (id: string) => void;
}) {
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
    <group name={`focus-plant:${plant.id}`} position={plotPosition(plant.plotIndex, layout.cols, layout.rows)}>
      <PlotBed highlight={plant.highlight} onClick={() => onOpen(plant.id)} />
      <Signboard
        name={plant.name}
        ticker={plant.ticker}
        far={far}
        fontReady={fontReady}
        onOpen={() => onOpen(plant.id)}
      />
      <group
        scale={plant.scale * 1.35}
        position={[0, 0.24, 0]}
        onClick={(event) => {
          event.stopPropagation();
          if (event.delta > 2) return;
          onOpen(plant.id);
        }}
      >
        {far ? (
          <SimplePlant stage={plant.stage} tone={plant.tone} traits={plant.traits} />
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
              traits={plant.traits}
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
      {plant.rangeEffect.kind === "fire" && (
        <Flame
          effect={plant.rangeEffect}
          reduced={reduced}
          y={0.24 + plant.scale * 1.35 * canopyPeakY(plant.traits, plant.stage)}
        />
      )}
      {plant.rangeEffect.kind === "aura" && (
        <DarkAura intensity={plant.rangeEffect.intensity} reduced={reduced} />
      )}
      {plant.crossMark && (
        <CrossCrownMark mark={plant.crossMark} y={0.24 + plant.scale * 1.35 * canopyPeakY(plant.traits, plant.stage)} />
      )}
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
      if (event.delta > 2) return;
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

function Island({ radius, depth }: { radius: number; depth: number }) {
  // A single mipmapped pigment texture and two static instanced meadow draws.
  const pigment = useGroundPigment(radius);
  return (
    <group>
      <RimMeadow radius={radius} />
      <mesh name="painted-island-ground" position={[0, -0.22, 0]}>
        <cylinderGeometry args={[radius, radius * 0.98, 0.4, 48]} />
        <meshStandardMaterial map={pigment} roughness={1} flatShading />
      </mesh>
      <mesh name="rounded-planet" position={[0, -0.41, 0]} scale={[1, depth * 2.1 / radius, 1]}>
        <sphereGeometry args={[radius * 0.985, 64, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#a58a62" roughness={1} />
      </mesh>
      {[0.12, 0.3, 0.48].map((a,i)=><mesh key={a} rotation={[-Math.PI/2,0,0]} position={[0,-0.41-Math.sin(a)*depth*2.1,0]}>
        <torusGeometry args={[radius*0.986*Math.cos(a),0.024,4,80]} />
        <meshBasicMaterial color={i%2?'#786e54':'#c6b283'} />
      </mesh>)}
      <MinhwaLandscape radius={radius} />
      {Array.from({ length: 18 }, (_, i) => {
        const angle = i * Math.PI * 2 / 18;
        const r = radius * (0.91 + (i % 3) * 0.015);
        const size = Math.min(0.48, radius * 0.045) * (0.7 + (i % 4) * 0.16);
        return (
          <group key={i} position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]} rotation={[0, angle, 0]}>
            <mesh position={[0, size * 0.18, 0]} scale={[1.3, 0.65, 0.85]}>
              <dodecahedronGeometry args={[size, 0]} />
              <meshStandardMaterial color={i % 2 ? "#d2c3a0" : "#849071"} roughness={1} flatShading />
            </mesh>
            <mesh position={[size, 0.1, -size * 0.3]} rotation={[0, angle, 0]}>
              <coneGeometry args={[0.09, 0.32, 4]} />
              <meshLambertMaterial color="#71865b" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Fence({ radius }: { radius: number }) {
 return <group name="ink-boundary">{[0,0.09].map((offset,i)=><mesh key={i} rotation={[-Math.PI/2,0,0]} position={[0,0.015,0]}>
  <torusGeometry args={[radius-offset,0.018,4,80]} /><meshBasicMaterial color={i?'#b3b080':'#526453'} />
 </mesh>)}</group>;
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
        <mesh key={index} position={[-2.4 + index * 1.6, index % 2 ? 0.3 : 0, -index]} scale={[1.4, 0.55, 1]}>
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

function Lights({ regime, span }: { regime: WeatherRegime; span: number }) {
  const sky = regime === "bull" ? "#eee6cf" : regime === "bear" ? "#ccd4d0" : "#e6e3d3";
  return (
    <>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[sky, ...sceneFogDistances(span)]} />
      <ambientLight color="#fff6e8" intensity={regime === "bear" ? 0.65 : 0.5} />
      <hemisphereLight args={["#f5f3df", "#646c69", 0.65]} />
      <directionalLight
        position={[-8, 12, 7]}
        intensity={regime === "bull" ? 1.25 : regime === "bear" ? 0.88 : 1.02}
        color={regime === "bear" ? "#e8eef3" : "#fff1d2"}
      />
      <directionalLight position={[8, 4, -6]} intensity={0.55} color="#d6e6ed" />
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
  kosdaqReturn1d,
  reduced,
  onOpen,
  onEmpty,
  onHarvested,
  onCancelFocus,
  command,
}: {
  command: { kind: "home" | "in" | "out"; serial: number };
  plants: ScenePlant[];
  weather: WeatherRegime;
  kosdaqReturn1d: number;
  reduced: boolean;
  onOpen: (id: string) => void;
  onEmpty: (index: number) => void;
  onHarvested: (id: string) => void;
  onCancelFocus: () => void;
}) {
  const layout = layoutFromPositions(plants);
  const occupied = new Map(plants.map((plant) => [plant.plotIndex, plant]));
  const plots = Array.from({ length: layout.count }, (_, index) => index);
  const { radius, depth, fenceRadius } = islandProfile(layout);
  const span = Math.max(layout.cols, layout.rows) * CELL;
  const [fontReady, setFontReady] = useState(false);
  const far = useSceneFar(plants.length > 100 ? LOD_DISTANCE : Math.max(LOD_DISTANCE, radius * 4));
  const camera = useThree((state) => state.camera);
  const controls = useRef<OrbitControlsImpl>(null);
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);
  const focused = plants.find((plant) => plant.highlight);
  const focusId = focused?.id;
  const activeFocus = useRef(focusId);
  useEffect(() => { activeFocus.current = focusId; }, [focusId]);
  const size = useThree((state) => state.size);
  const overview = useMemo(() => overviewPose(radius, size.width / size.height), [radius, size.width, size.height]);
  const destination = useRef<{ position: Vector3; target: Vector3 } | null>(null);
  const handledCommand = useRef(0);
  // Resize/garden changes fit immediately; explicit navigation eases without auto-orbit.
  useEffect(() => {
    if (!controls.current || activeFocus.current) return;
    camera.position.fromArray(overview.position);
    controls.current.target.fromArray(overview.target);
    controls.current.update();
    destination.current = null;
  }, [camera, overview]);
  useEffect(() => {
    if (!controls.current || command.serial === 0 || handledCommand.current === command.serial) return;
    handledCommand.current = command.serial;
    activeFocus.current = undefined;
    onCancelFocus();
    const orbit = controls.current;
    if (command.kind === "home") {
      destination.current = { position: new Vector3(...overview.position), target: new Vector3(...overview.target) };
    } else {
      const offset = camera.position.clone().sub(orbit.target);
      const distance = Math.max(3.2, Math.min(overview.distance * 1.7, offset.length() * (command.kind === "in" ? 0.78 : 1.28)));
      destination.current = { position: orbit.target.clone().add(offset.setLength(distance)), target: orbit.target.clone() };
    }
  }, [camera, command, overview, onCancelFocus]);
  useFrame((_, delta) => {
    const pose = destination.current;
    const orbit = controls.current;
    if (!pose || !orbit) return;
    const alpha = reduced ? 1 : 1 - Math.exp(-delta * 7);
    camera.position.lerp(pose.position, alpha);
    orbit.target.lerp(pose.target, alpha);
    orbit.update();
    if (camera.position.distanceToSquared(pose.position) < 0.0001 && orbit.target.distanceToSquared(pose.target) < 0.0001) destination.current = null;
  });
  useEffect(() => {
    const canvas = gl.domElement;
    const host = canvas.closest("[data-garden-viewport]");
    const hud = host?.querySelector("header");
    const navigation = host?.querySelector("[data-focus-navigation]");
    let frame = 0;
    const fit = () => {
      if (!activeFocus.current || activeFocus.current !== focusId || !controls.current) return;
      const plant = scene.getObjectByName(`focus-plant:${focusId}`);
      if (!plant) return;
      const rect = canvas.getBoundingClientRect();
      const safe = focusSafeRect(rect, hud?.getBoundingClientRect(), navigation?.getBoundingClientRect());
      // An open overlay can consume the whole canvas; refit when it closes.
      if (safe.bottom <= safe.top || safe.right <= safe.left) return;
      scene.updateMatrixWorld(true);
      // Includes the actual canopy, sign, fire, aura and crown marks. Padding
      // covers flame flicker, wind and billboard rotation between frames.
      const bounds = new Box3().setFromObject(plant).expandByScalar(0.3);
      destination.current = fitFocusBounds(bounds, camera.position.clone().sub(controls.current.target),
        { width: rect.width, height: rect.height }, safe, (camera as PerspectiveCamera).fov);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); };
    const observer = new ResizeObserver(schedule);
    [canvas, hud, navigation].forEach((element) => { if (element) observer.observe(element); });
    schedule();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [camera, scene, gl, focusId, size.width, size.height, far]);
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
      <Lights regime={weather} span={Math.max(span, overview.distance * 1.4)} />
      <Island radius={radius} depth={depth} />
      <Fence radius={fenceRadius} />
      <Clouds regime={weather} reduced={reduced} />
      <MinhwaClouds radius={radius} />
      {weather === "bear" && !reduced && <Rain />}
      {kosdaqReturn1d > 0 && !reduced && <Butterflies reduced={reduced} radius={radius} />}
      {kosdaqReturn1d < 0 && !reduced && <Thunder reduced={reduced} />}
      {plots.map((index) => {
        const plant = occupied.get(index);
        if (!plant) {
          if (plants.length >= 16) return null;
          return <EmptyPlot key={index} index={index} layout={layout} onEmpty={onEmpty} />;
        }
        return (
          <GardenPlant
            key={plant.id}
            plant={plant}
            weather={weather}
            reduced={reduced}
            far={far}
            fontReady={fontReady}
            layout={layout}
            onOpen={onOpen}
            onHarvested={onHarvested}
          />
        );
      })}
      <OrbitControls
        ref={controls}
        makeDefault
        enableRotate
        enablePan
        enableZoom
        enableDamping={!reduced}
        onStart={() => { destination.current = null; activeFocus.current = undefined; onCancelFocus(); }}
        dampingFactor={0.12}
        rotateSpeed={0.7}
        zoomSpeed={0.85}
        minDistance={3.2}
        maxDistance={overview.distance * 1.7}
        minPolarAngle={0.18}
        maxPolarAngle={Math.PI / 2 - 0.08}
      />
    </>
  );
}

export default function GardenScene(props: {
  plants: ScenePlant[];
  weather: WeatherRegime;
  kosdaqReturn1d: number;
  reduced: boolean;
  onOpen: (id: string) => void;
  onEmpty: (index: number) => void;
  onHarvested: (id: string) => void;
  onCancelFocus: () => void;
}) {
  const [command, setCommand] = useState<{ kind: "home" | "in" | "out"; serial: number }>({ kind: "home", serial: 0 });
  const layout = layoutFromPositions(props.plants);
  const span = Math.max(layout.cols, layout.rows) * CELL;
  return (
    <div className="absolute inset-0">
    <Canvas
      dpr={[1, 1.2]}
      camera={{
        position: [0.1, Math.max(6.8, span * 0.38), Math.max(8.6, span * 0.5)],
        fov: 42,
        near: 0.1,
        far: Math.max(240, span * 18),
      }}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
    >
      <Scene {...props} command={command} />
    </Canvas>
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.055]" xmlns="http://www.w3.org/2000/svg"><filter id="hanji-grain"><feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="3" stitchTiles="stitch" /></filter><rect width="100%" height="100%" filter="url(#hanji-grain)" /></svg>
    <div aria-hidden="true" className="pointer-events-none absolute bottom-8 right-6 hidden text-right sm:block"><span className="font-display text-sm tracking-[0.25em] text-[#596c5a]">民畵 · 작은 별의 정원</span><span className="ml-2 inline-block border border-[#a35643] px-1 font-display text-xs text-[#a35643]">그루밭</span></div>
    <div data-focus-navigation className="absolute bottom-20 left-4 z-20 flex flex-col items-start gap-2 lg:bottom-6 lg:left-6">
      <p className="pointer-events-none hidden rounded-full bg-[#fffaf2]/90 px-3 py-1 text-xs text-[#615b48] sm:block">드래그로 둘러보기 · 휠 / 두 손가락으로 확대</p>
      <div role="group" aria-label="정원 시점 조작" className="flex gap-1 rounded-2xl border border-[#d9c8aa] bg-[#fffaf2]/95 p-1 shadow-lg backdrop-blur-sm">
        {([{ kind: "home", label: "정원 전체 보기", text: "전체 보기" }, { kind: "in", label: "정원 확대", text: "+" }, { kind: "out", label: "정원 축소", text: "−" }] as const).map(({ kind, label, text }) => (
          <button key={kind} type="button" aria-label={label} title={label} onClick={() => setCommand((old) => ({kind, serial: old.serial + 1}))} className="min-h-11 min-w-11 rounded-xl px-3 font-display text-lg text-[#43553b] hover:bg-[#e7eddb] focus-visible:outline-2 focus-visible:outline-[#547e41]">{text}</button>
        ))}
      </div>
    </div>
    </div>
  );
}
