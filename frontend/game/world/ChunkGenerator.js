// game/world/ChunkGenerator.js
//
// Builds one 60 m slice of ocean ("chunk") from the run seed. This is a PURE
// function: same seed + same chunk number => exactly the same coins,
// bubbles, chests and creatures, every time. It doesn't create any sprites
// — it just returns a plain list of "put a jellyfish at (x, y)". The scene
// turns that list into sprites. Deciding WHAT goes in the world and DRAWING
// it are two different jobs, in two different files (high cohesion).
//
// Every collectible gets an id like "c:7:3" = coin #3 of chunk 7. The
// server uses those ids to refuse a coin that's collected twice, or a coin
// claimed from a chunk nowhere near the diver.

import { chunkRng, between, intBetween, chance, pick } from "../rng";
import { CHUNK_PX, PX_PER_METER, PLAY_LEFT, PLAY_RIGHT } from "../config";

const LEFT = PLAY_LEFT + 60;
const RIGHT = PLAY_RIGHT - 60;

// How busy each zone is. Deeper = more dangerous, fewer bubbles, richer coins.
const DENSITY = {
  sunlight: { patterns: [1, 2], bubbles: 0.8, chest: 0.10, hazards: { jelly: [0, 1] }, schools: 0.7 },
  twilight: { patterns: [1, 2], bubbles: 0.65, chest: 0.14, hazards: { jelly: [1, 2], puffer: [0, 1] }, schools: 0.4 },
  midnight: { patterns: [2, 2], bubbles: 0.55, chest: 0.16, hazards: { jelly: [0, 1], puffer: [0, 1], angler: [1, 1] }, schools: 0.1 },
  abyss:    { patterns: [2, 3], bubbles: 0.5, chest: 0.2, hazards: { urchin: [2, 3], angler: [1, 1], jelly: [0, 1] }, schools: 0 },
};

// Coin patterns — the Subway Surfers trick: coins in shapes are a path to
// follow, and following a path feels like skill.
const PATTERNS = {
  line: (rng, x, y) => Array.from({ length: 6 }, (_, i) => ({ x, y: y + i * 46 })),
  diagonal: (rng, x, y) => {
    const dir = chance(rng, 0.5) ? 1 : -1;
    return Array.from({ length: 6 }, (_, i) => ({ x: x + dir * i * 40, y: y + i * 40 }));
  },
  wave: (rng, x, y) => Array.from({ length: 8 }, (_, i) => ({ x: x + Math.sin(i * 0.9) * 70, y: y + i * 38 })),
  ring: (rng, x, y) => Array.from({ length: 8 }, (_, i) => ({
    x: x + Math.cos((i / 8) * Math.PI * 2) * 70,
    y: y + 70 + Math.sin((i / 8) * Math.PI * 2) * 70,
  })),
  arc: (rng, x, y) => Array.from({ length: 7 }, (_, i) => ({ x: x - 120 + i * 40, y: y + 60 - Math.sin((i / 6) * Math.PI) * 60 })),
};

function zoneIdAt(depth, zones) {
  let id = zones[0].id;
  zones.forEach((z) => { if (depth >= z.from) id = z.id; });
  return id;
}

export function generateChunk(seed, chunkIndex, { zones, gateDepths }) {
  const rng = chunkRng(seed, chunkIndex);
  const top = chunkIndex * CHUNK_PX;
  const depth = top / PX_PER_METER;
  const density = DENSITY[zoneIdAt(depth, zones)];
  const out = { coins: [], bubbles: [], chests: [], hazards: [], schools: [] };
  const taken = []; // circles already used, so things don't overlap

  // Keep a clear band around any gate in this chunk.
  const gateYs = gateDepths.map((d) => d * PX_PER_METER).filter((y) => y >= top - 100 && y <= top + CHUNK_PX + 100);
  const clear = (x, y, r) =>
    !gateYs.some((gy) => Math.abs(gy - y) < 110) && taken.every((t) => Math.hypot(t.x - x, t.y - y) > t.r + r);
  const claim = (x, y, r) => taken.push({ x, y, r });

  // The first slice is a calm welcome: a coin trail straight down, nothing else.
  if (chunkIndex === 0) {
    PATTERNS.line(rng, 640, 230).forEach((p, i) => out.coins.push({ id: `c:0:${i}`, ...p }));
    return out;
  }

  // 1. Coin patterns.
  let coinIndex = 0;
  const patternCount = intBetween(rng, density.patterns[0], density.patterns[1]);
  for (let p = 0; p < patternCount; p++) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const x = between(rng, LEFT + 120, RIGHT - 120);
      const y = top + between(rng, 20, CHUNK_PX - 320);
      const shape = PATTERNS[pick(rng, Object.keys(PATTERNS))](rng, x, y);
      const cx = shape.reduce((s, c) => s + c.x, 0) / shape.length;
      const cy = shape.reduce((s, c) => s + c.y, 0) / shape.length;
      if (!shape.every((c) => c.x > LEFT && c.x < RIGHT && clear(c.x, c.y, 18))) continue;
      claim(cx, cy, 150);
      shape.forEach((c) => out.coins.push({ id: `c:${chunkIndex}:${coinIndex++}`, x: c.x, y: c.y }));
      break;
    }
  }

  // 2. Air bubbles — the oxygen economy.
  let bubbleIndex = 0;
  const bubbleTries = chance(rng, density.bubbles) ? (chance(rng, 0.35) ? 2 : 1) : 0;
  for (let b = 0; b < bubbleTries; b++) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const x = between(rng, LEFT, RIGHT);
      const y = top + between(rng, 30, CHUNK_PX - 30);
      if (!clear(x, y, 40)) continue;
      claim(x, y, 40);
      out.bubbles.push({ id: `b:${chunkIndex}:${bubbleIndex++}`, x, y });
      break;
    }
  }

  // 3. A chest (optional bonus puzzle).
  if (chance(rng, density.chest)) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const x = between(rng, LEFT + 40, RIGHT - 40);
      const y = top + between(rng, 60, CHUNK_PX - 60);
      if (!clear(x, y, 60)) continue;
      claim(x, y, 60);
      out.chests.push({ id: `k:${chunkIndex}:0`, x, y });
      break;
    }
  }

  // 4. Hazards, by zone.
  if (chunkIndex >= 2) {
    for (const [kind, [min, max]] of Object.entries(density.hazards)) {
      const count = intBetween(rng, min, max);
      for (let h = 0; h < count; h++) {
        for (let attempt = 0; attempt < 8; attempt++) {
          const x = between(rng, LEFT, RIGHT);
          const y = top + between(rng, 40, CHUNK_PX - 40);
          const r = kind === "angler" ? 90 : 60;
          if (!clear(x, y, r)) continue;
          claim(x, y, r);
          out.hazards.push({ kind, x, y, phase: rng() * Math.PI * 2, speed: between(rng, 0.6, 1.4) });
          break;
        }
      }
    }
  }

  // 5. Decorative fish schools (no physics, no ids — just life).
  if (chance(rng, density.schools)) {
    out.schools.push({
      y: top + between(rng, 80, CHUNK_PX - 80),
      dir: chance(rng, 0.5) ? 1 : -1,
      count: intBetween(rng, 5, 9),
      tint: pick(rng, [0xffd27a, 0x9ff3ff, 0xff9fd0, 0xb8ffb0]),
    });
  }

  return out;
}
