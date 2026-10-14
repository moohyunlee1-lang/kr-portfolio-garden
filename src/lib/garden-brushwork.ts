/** Original procedural pigment; inspired by the folktale's painted ground, not its assets. */
export function groundPigment(size = 256): Uint8Array {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
    // Periodic washes avoid a hard seam when repeated over a large island.
    const wash = Math.sin(u * 3 + Math.cos(v * 2)) * 10 + Math.cos(v * 5 - u * 2) * 6;
    const grain = ((Math.imul(x + 17, 374761393) ^ Math.imul(y + 31, 668265263)) >>> 0) % 19 - 9;
    const i = (y * size + x) * 4;
    pixels[i] = 154 + wash + grain;
    pixels[i + 1] = 174 + wash + grain * 0.6;
    pixels[i + 2] = 112 + wash * 0.7 + grain * 0.5;
    pixels[i + 3] = 255;
  }
  return pixels;
}

/** Rim only: islandProfile puts every bed at least 0.6 world units inside the edge. */
export function meadowInstances(radius: number) {
  return Array.from({ length: 360 }, (_, i) => {
    const angle = i * 2.399963229728653;
    const r = radius - 0.08 - ((i * 37) % 101) / 101 * 0.41;
    return { x: Math.cos(angle) * r, z: Math.sin(angle) * r,
      angle, height: 0.12 + (i % 7) * 0.025, flower: i % 5 === 0 };
  });
}
