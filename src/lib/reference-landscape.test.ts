import { expect, it } from 'vitest';
import { mountainGeometry, meadowBladeGeometry } from './reference-landscape';
it('sculpts layered ridge relief and curved long-leaf clumps within a fixed budget',()=>{
 const g=mountainGeometry();g.computeBoundingBox();
 expect(g.boundingBox!.max.y).toBeGreaterThan(1.5);
 expect(g.boundingBox!.max.z-g.boundingBox!.min.z).toBeGreaterThan(.5);
 expect(g.attributes.color.count).toBe(g.attributes.position.count);
 expect(g.attributes.position.count).toBeLessThan(10000);
 const blade=meadowBladeGeometry();blade.computeBoundingBox();
 expect(blade.boundingBox!.max.y).toBeGreaterThan(.8);
 expect(blade.boundingBox!.max.x-blade.boundingBox!.min.x).toBeGreaterThan(.4);
 expect(blade.attributes.position.count).toBeLessThan(400);
});
