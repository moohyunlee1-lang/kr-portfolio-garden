import type { TreeTraits, EarningsTone } from './tree-traits';
export function minhwaPalette(tone: EarningsTone) {
 return tone === 'dark'
  ? {trunk:'#473d32',leaf:'#254d48',leaf2:'#355d59',leaf3:'#496b58'}
  : {trunk:'#66503a',leaf:'#357d70',leaf2:'#60947b',leaf3:'#a0b47c'};
}
export type TreePart = {kind:'trunk'|'crown';position:[number,number,number];scale:[number,number,number];color:string};
/** Small bush / round deciduous / tiered spreading pine; independent of holding scale. */
export function minhwaTreeParts(traits:TreeTraits):TreePart[] {
 const c=minhwaPalette(traits.tone), n=traits.foliage==='dense'?4:traits.foliage==='sparse'?2:3;
 const p:TreePart[]=[];
 if(traits.size==='large') {
  p.push({kind:'trunk',position:[0,0.67,0],scale:[0.075,0.67,0.075],color:c.trunk});
  for(let i=0;i<n;i++) p.push({kind:'crown',position:[(i%2?1:-1)*(0.14-i*0.025),0.86+i*0.31,0],scale:[0.53-i*0.075,0.18-i*0.012,0.39-i*0.052],color:[c.leaf,c.leaf2,c.leaf3,c.leaf2][i]});
 } else if(traits.size==='mid') {
  p.push({kind:'trunk',position:[0,0.4,0],scale:[0.065,0.4,0.065],color:c.trunk});
  p.push({kind:'crown',position:[0,0.98,0],scale:[0.36,0.35,0.32],color:c.leaf});
  for(let i=1;i<n;i++) p.push({kind:'crown',position:[i%2?-0.25:0.24,0.87+(i===3?0.35:0),0.06],scale:[0.24,0.25,0.23],color:i%2?c.leaf2:c.leaf3});
 } else {
  p.push({kind:'trunk',position:[0,0.12,0],scale:[0.045,0.12,0.045],color:c.trunk});
  for(let i=0;i<n;i++) p.push({kind:'crown',position:[(i-(n-1)/2)*0.16,0.29+(i%2)*0.07,0],scale:[0.23,0.18,0.25],color:[c.leaf,c.leaf2,c.leaf3,c.leaf2][i]});
 }
 return p;
}
