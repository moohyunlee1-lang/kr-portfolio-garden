import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Color, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { minhwaTreeParts } from './minhwa';
import type { TreeTraits } from './tree-traits';

const cache = new Map<string, BufferGeometry>();
/** Shared vertex-colored sculpture. Detail is geometry, not a picture pasted onto a crown. */
export function referenceTreeGeometry(traits:TreeTraits, far:boolean) {
 const key=`${traits.size}/${traits.tone}/${traits.foliage}/${far}`;
 const saved=cache.get(key); if(saved)return saved;
 const parts:BufferGeometry[]=[];
 const add=(g:BufferGeometry,color:string)=>{
  const c=new Color(color), a=new Float32Array(g.attributes.position.count*3);
  for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}
  g.setAttribute('color',new BufferAttribute(a,3));
  const flat=g.index?g.toNonIndexed():g; if(flat!==g)g.dispose();
  g=flat;g.deleteAttribute('uv');parts.push(g);
 };
 const line=(points:Vector3[],radius:number,color:string,segments=6)=>add(new TubeGeometry(new CatmullRomCurve3(points),segments,radius,far?3:5,false),color);
 const specs=minhwaTreeParts(traits), trunk=specs[0], h=trunk.scale[1]*2;
 const center=(y:number)=>new Vector3(Math.sin(y/h*6.2)*0.075,y,Math.sin(y/h*3)*0.025);
 const bark=traits.tone==='dark'?'#634536':'#985637';
 line([center(0),center(h*.3),center(h*.65),center(h)],trunk.scale[0]*1.15,bark,far?5:12);
 let barkLines=0,needleFans=0;
 if(!far) for(let j=0;j<8;j++){
  const a=j*Math.PI/4, r=trunk.scale[0]*1.16;
  const points=Array.from({length:8},(_,i)=>{const y=h*i/7;return center(y).add(new Vector3(Math.cos(a+y*1.8)*r,0,Math.sin(a+y*1.8)*r));});
  line(points,j%3===0?.008:.004,j%3===0?'#382e25':'#cd9360',12);barkLines++;
 }
 for(const p of specs.filter(p=>p.kind==='crown')) {
  if(traits.size==='large') {
   const fans=far?6:15;
   // Each branch extends horizontally below its fan instead of disappearing in a solid umbrella.
   if(!far) for(let b=0;b<3;b++){
    const a=b*Math.PI*2/3;
    line([center(p.position[1]*.62),new Vector3(p.position[0]*.5,p.position[1]-.16,0),new Vector3(p.position[0]+Math.cos(a)*p.scale[0]*.72,p.position[1]-.035,Math.sin(a)*p.scale[2]*.72)],.022,bark,5);
   }
   for(let j=0;j<fans;j++) {
    const a=j*2.399963, r=Math.sqrt((j+.5)/fans);
    const origin=new Vector3(p.position[0]+Math.cos(a)*p.scale[0]*r*.85,p.position[1]-.06+r*.025,p.position[2]+Math.sin(a)*p.scale[2]*r*.85);
    const vertices:number[]=[];
    const needles=far?5:11;
    for(let k=0;k<needles;k++) {
     const angle=k*Math.PI*2/needles+a, len=(.14+(k%3)*.022)*(1-r*.15), width=far?.025:.012;
     const tip=origin.clone().add(new Vector3(Math.cos(angle)*len,.1+Math.sin(k*2)*.035,Math.sin(angle)*len));
     vertices.push(origin.x-Math.sin(angle)*width,origin.y,origin.z+Math.cos(angle)*width,tip.x,tip.y,tip.z,origin.x+Math.sin(angle)*width,origin.y,origin.z-Math.cos(angle)*width);
    }
    const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(vertices),3));g.computeVertexNormals();
    add(g,j%3===0?(traits.tone==='dark'?'#42604d':'#94a86a'):p.color);needleFans++;
   }
  } else {
   const lobes=far?1:5;
   for(let j=0;j<lobes;j++) {
    const a=j*2.399963;
    const g=new SphereGeometry(1,far?7:9,far?4:6);
    g.scale(p.scale[0]*(far?1:.7),p.scale[1]*(far?1:.8),p.scale[2]*(far?1:.7));
    g.translate(p.position[0]+(far?0:Math.cos(a)*p.scale[0]*.45),p.position[1]+(j%2)*.04,p.position[2]+(far?0:Math.sin(a)*p.scale[2]*.45));add(g,p.color);
   }
   if(!far) for(let j=0;j<7;j++) {
    const a=j*2.399963, r=p.scale[0]*.8;
    const start=new Vector3(p.position[0]+Math.cos(a)*r*.35,p.position[1]+p.scale[1]*.8,p.position[2]+Math.sin(a)*r*.35);
    line([start,start.clone().add(new Vector3(Math.cos(a)*r*.3,.012,Math.sin(a)*r*.3)),start.clone().add(new Vector3(Math.cos(a)*r*.6,-.04,Math.sin(a)*r*.6))],.004,traits.tone==='dark'?'#203f37':'#42694a',3);
   }
  }
 }
 const merged=mergeGeometries(parts,false)!;parts.forEach(g=>g.dispose());merged.computeBoundingSphere();
 merged.userData={needleFans,barkLines};cache.set(key,merged);return merged;
}
