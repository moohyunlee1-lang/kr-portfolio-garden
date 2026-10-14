"use client";
import { useEffect, useMemo } from 'react';
import { Billboard } from '@react-three/drei';
import { CanvasTexture, SRGBColorSpace } from 'three';
/** Original 운문 brush drawing, one shared texture and three bounded draws. */
export function MinhwaClouds({radius}:{radius:number}) {
 const texture=useMemo(()=>{
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const c=canvas.getContext('2d')!;c.scale(2,2);
  c.beginPath();c.moveTo(18,86);c.bezierCurveTo(0,67,28,49,52,62);c.bezierCurveTo(42,22,94,13,113,43);c.bezierCurveTo(126,8,176,23,177,55);c.bezierCurveTo(205,35,231,58,219,77);c.bezierCurveTo(255,74,251,104,225,105);c.lineTo(37,105);c.bezierCurveTo(10,106,2,89,18,86);c.closePath();
  c.fillStyle='#efe8d4';c.fill();c.strokeStyle='#748879';c.lineWidth=2;c.stroke();
  c.beginPath();c.moveTo(23,87);c.bezierCurveTo(52,103,76,76,56,68);c.bezierCurveTo(32,59,23,87,51,85);c.moveTo(99,63);c.bezierCurveTo(77,72,82,37,102,45);c.bezierCurveTo(124,52,105,83,87,82);c.lineTo(165,82);c.bezierCurveTo(191,83,192,57,173,62);c.bezierCurveTo(159,66,174,79,181,70);c.moveTo(129,94);c.lineTo(228,94);c.stroke();
  const t=new CanvasTexture(canvas);t.colorSpace=SRGBColorSpace;return t;
 },[]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 return <group name="minhwa-cloud-scrolls">
  {[[ -radius*0.83,-0.5,radius*0.65],[radius*0.94,0.4,radius*0.25],[radius*0.4,-radius*0.44,radius*0.62]].map((p,i)=><Billboard key={i} position={p as [number,number,number]}><mesh raycast={()=>{}}><planeGeometry args={[Math.min(3.4,radius*0.42),Math.min(1.7,radius*0.21)]} /><meshBasicMaterial map={texture} transparent depthWrite={false} opacity={0.95} /></mesh></Billboard>)}
 </group>;
}
