// Dawn Courier — seeded random numbers.
// A tiny deterministic generator so the valley, the trees and the rings are
// identical every time the page loads with the same seed (&seed=1). The shots
// and the judge both get the same world.

// mulberry32: a small fast seeded PRNG with a good spread for our sizes.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A 2D value-noise field built from a seeded grid, with smooth interpolation.
// Returns roughly -1..1. Cheap and smooth enough for rolling mountain noise.
export function makeNoise2D(seed) {
  const rand = mulberry32(seed);
  const SIZE = 64;
  const grid = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < grid.length; i++) grid[i] = rand() * 2 - 1;

  const fade = (t) => t * t * (3 - 2 * t);
  const at = (ix, iz) => {
    const x = ((ix % SIZE) + SIZE) % SIZE;
    const z = ((iz % SIZE) + SIZE) % SIZE;
    return grid[z * SIZE + x];
  };
  return function noise(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = fade(x - ix);
    const fz = fade(z - iz);
    const a = at(ix, iz);
    const b = at(ix + 1, iz);
    const c = at(ix, iz + 1);
    const d = at(ix + 1, iz + 1);
    const ab = a + (b - a) * fx;
    const cd = c + (d - c) * fx;
    return ab + (cd - ab) * fz;
  };
}

// Fractal Brownian motion: a few octaves of value noise, normalised to ~-1..1.
// The weights (0.55 / 0.3 / 0.15) sum to 1, so the output stays in range
// and the mountains keep their rolling, ridged character.
export function makeFbm(seed) {
  const n1 = makeNoise2D(seed);
  const n2 = makeNoise2D(seed + 101);
  const n3 = makeNoise2D(seed + 211);
  return function fbm(x, z) {
    return (
      n1(x, z) * 0.55 +
      n2(x * 2.1, z * 2.1) * 0.3 +
      n3(x * 4.3, z * 4.3) * 0.15
    );
  };
}

// A random float in [lo, hi) from a seeded generator.
export function randRange(rand, lo, hi) {
  return lo + rand() * (hi - lo);
}

// A random integer in [lo, hi] inclusive, from a seeded generator.
export function randInt(rand, lo, hi) {
  return lo + Math.floor(rand() * (hi - lo + 1));
}

// Clamp a number into [lo, hi].
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Smoothstep between 0 and 1 over [a, b].
export function smoothstep(a, b, v) {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Linear interpolation.
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
