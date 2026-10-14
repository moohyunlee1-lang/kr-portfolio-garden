"use client";
import { DoubleSide, MeshStandardMaterial } from 'three';
import { referenceTreeGeometry } from '@/lib/reference-sculpture';
import type { TreeTraits } from '@/lib/tree-traits';

const material = new MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:DoubleSide});
material.onBeforeCompile = (shader) => {
 shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
 float ink = smoothstep(0.08, 0.38, abs(dot(normal, normalize(vViewPosition))));
 float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453);
 outgoingLight *= mix(0.48, 1.0, ink) * (0.96 + grain * 0.06);
 #include <opaque_fragment>`);
};
export function MinhwaTree({traits,far=false}:{traits:TreeTraits;far?:boolean}) {
 return <mesh name="minhwa-mineral-tree" geometry={referenceTreeGeometry(traits,far)} material={material} dispose={null} />;
}
