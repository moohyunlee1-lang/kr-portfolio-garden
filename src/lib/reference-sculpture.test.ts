import { expect, it } from 'vitest';
import { referenceTreeGeometry } from './reference-sculpture';
import type { TreeTraits } from './tree-traits';
it('builds bounded cached needle and bark sculpture with distinct financial silhouettes', () => {
 const t:TreeTraits={size:'large',tone:'bright',foliage:'dense',label:''};
 const pine=referenceTreeGeometry(t,false), far=referenceTreeGeometry(t,true);
 expect(referenceTreeGeometry(t,false)).toBe(pine);
 expect(pine.userData.needleFans).toBeGreaterThan(20);
 expect(pine.userData.barkLines).toBeGreaterThan(4);
 expect(far.attributes.position.count).toBeLessThan(pine.attributes.position.count);
 expect(far.attributes.position.count).toBeLessThan(2200);
 for(const size of ['small','mid'] as const) expect(referenceTreeGeometry({...t,size},false).userData.needleFans).toBe(0);
 const sparse=referenceTreeGeometry({...t,foliage:'sparse'},false);
 expect(sparse.userData.needleFans).toBeLessThan(pine.userData.needleFans);
 pine.computeBoundingBox(); expect(pine.boundingBox!.max.y).toBeLessThan(2.1);
});
