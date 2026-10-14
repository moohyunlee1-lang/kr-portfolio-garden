"use client";
import { mountainGeometry } from '@/lib/reference-landscape';
const ridge=mountainGeometry();
/** Bounded world-space mountain amphitheatre; actual parallax and folded rock relief. */
export function MinhwaLandscape({radius}:{radius:number}) {
 const unit=Math.min(3.5,Math.max(1,radius*.14));
 return <group name="minhwa-folded-landscape">
  {Array.from({length:9},(_,i)=>{
   const a=(i-4)*.23, r=radius*1.06;
   return <mesh key={i} name="mineral-mountain" geometry={ridge} dispose={null} raycast={()=>{}}
    position={[Math.sin(a)*r,-.25,-Math.cos(a)*r]}
    rotation={[0,a+.25,0]} scale={[unit*(.8+i%3*.2),unit*(.7+i%3*.2),unit]}>
    <meshStandardMaterial vertexColors roughness={1} />
   </mesh>;
  })}
  {Array.from({length:5},(_,i)=><mesh key={i} geometry={ridge} dispose={null} raycast={()=>{}}
   position={[(i-2)*unit*1.6,-.3,-radius*.96]} scale={[unit*1.2,unit*.32,unit*.7]} rotation={[0,i*.8,0]}>
   <meshStandardMaterial color={i%2?'#9a9e6f':'#6b8a71'} roughness={1}/>
  </mesh>)}
 </group>;
}
