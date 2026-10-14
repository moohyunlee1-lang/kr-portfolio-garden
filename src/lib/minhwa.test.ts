import { describe, expect, it } from 'vitest';
import { minhwaTreeParts, minhwaPalette } from './minhwa';
import type { TreeTraits } from './tree-traits';
const traits: TreeTraits = {size:'large',tone:'bright',foliage:'medium',label:''};
describe('minhwa tree sculpture', () => {
 it('keeps a tall pine with spreading cloud crowns instead of cones', () => {
  const p = minhwaTreeParts(traits);
  expect(p.filter(x=>x.kind==='crown')).toHaveLength(3);
  expect(p.filter(x=>x.kind==='crown').every(x=>x.scale[0]>x.scale[1]*2)).toBe(true);
  expect(Math.max(...p.map(x=>x.position[1]+x.scale[1]))).toBeGreaterThan(1.6);
 });
 it('preserves market-cap silhouettes and debt density without changing growth scale', () => {
  const top=(size:TreeTraits['size'])=>Math.max(...minhwaTreeParts({...traits,size}).map(x=>x.position[1]+x.scale[1]));
  expect(top('small')).toBeLessThan(top('mid'));expect(top('mid')).toBeLessThan(top('large'));
  expect(minhwaTreeParts({...traits,foliage:'dense'}).length).toBeGreaterThan(minhwaTreeParts({...traits,foliage:'sparse'}).length);
 });
 it('keeps negative-EPS leaves darker on the same mineral palette', () => {
  expect(minhwaPalette('dark').leaf).not.toEqual(minhwaPalette('bright').leaf);
 });
});
