// game/rng.js
//
// Seeded random numbers. Math.random() gives different numbers every
// time; a SEEDED generator gives the same sequence for the same seed. Feed
// it seed 42 today, seed 42 next week: identical "random" numbers.
//
// Why a game wants that: the server picks one seed per run and sends it.
// The ocean is then BUILT from that seed — so the same seed always makes the
// same ocean. That's how a world with no end fits in one number: nothing is
// stored, every slice is regenerated on demand, identically.
//
// mulberry32 is a well-known tiny generator: a few multiplies and bit
// shifts that scramble a 32-bit number. You don't need to understand the
// bit maths to use it — only that same input => same output.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // 0 <= n < 1
  };
}

// One generator PER CHUNK, mixed from the run seed + the chunk number.
// So chunk 7 is identical no matter whether you built chunks 0..6 first —
// order doesn't matter, which is what lets us throw chunks away and
// rebuild them later.
export function chunkRng(seed, chunkIndex) {
  return mulberry32((seed ^ Math.imul(chunkIndex + 1, 0x9e3779b1)) >>> 0);
}

export const between = (rng, min, max) => min + rng() * (max - min);
export const intBetween = (rng, min, max) => Math.floor(between(rng, min, max + 1));
export const chance = (rng, p) => rng() < p;
export const pick = (rng, list) => list[Math.floor(rng() * list.length)];
