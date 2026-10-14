import { BufferAttribute, BufferGeometry, Color } from 'three';
/** Ring-built folded rock: mineral bands follow actual relief, visible from either side. */
export function mountainGeometry() {
 const positions:number[]=[], colors:number[]=[];
 const rings=24,sides=32;
 const point=(r:number,s:number)=>{
  const t=r/rings,a=s/sides*Math.PI*2;
  const fold=1+.13*Math.sin(a*7+t*8)+.07*Math.sin(a*13-t*9);
  const radius=Math.pow(1-t,.7)*fold;
  return [Math.cos(a)*radius+Math.sin(t*5)*.16,t*2.4,Math.sin(a)*radius*.57];
 };
 for(let r=0;r<rings;r++) for(let s=0;s<sides;s++) {
  const c=new Color(['#4d7876','#638c7a','#9d9c69','#b6a27b','#376272','#527581'][Math.floor(r/4)%6]);
  if(s%5===0)c.multiplyScalar(.63);
  for(const [rr,ss] of [[r,s],[r+1,s],[r,s+1],[r,s+1],[r+1,s],[r+1,s+1]]) {positions.push(...point(rr,ss));colors.push(c.r,c.g,c.b);}
 }
 const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));g.setAttribute('color',new BufferAttribute(new Float32Array(colors),3));g.computeVertexNormals();return g;
}
/** Seven bent lanceolate leaves, not upright triangular cones. */
export function meadowBladeGeometry() {
 const p:number[]=[];
 for(let leaf=0;leaf<7;leaf++) {
  const a=leaf*2.399963,h=.6+(leaf%3)*.2;
  const point=(t:number,side:number)=>{const bend=t*t*.55,width=Math.sin(t*Math.PI)*.07*side;return [Math.cos(a)*bend-Math.sin(a)*width,t*h,Math.sin(a)*bend+Math.cos(a)*width];};
  for(let i=0;i<5;i++) {const t=i/5,u=(i+1)/5; for(const [v,s] of [[t,-1],[u,-1],[t,1],[t,1],[u,-1],[u,1]])p.push(...point(v,s));}
 }
 const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(p),3));g.computeVertexNormals();return g;
}
