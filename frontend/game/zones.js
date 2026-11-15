// game/zones.js
//
// How each ocean zone LOOKS. Where the zones START comes from the server
// (rules.zones in RUN_STARTED); this file only says what each one looks
// like. The server owns the rules, the client owns the paint.
//
// The "sea to sea" transition isn't a loading screen: every frame, the
// colours are BLENDED between the zone you're in and the next one, by how
// far through the zone you are. Swim down and the water slowly bruises from
// turquoise to ink. The gate at each boundary is where it becomes official.

export const ZONE_LOOK = {
  sunlight: { top: 0x2fb4e0, bottom: 0x0d5d96, rocks: 0x1f6e9c, rays: 0.55, dark: 0.0, snow: 0xd8f6ff, accent: 0x39e6c9 },
  twilight: { top: 0x123e78, bottom: 0x0a2150, rocks: 0x16325e, rays: 0.18, dark: 0.45, snow: 0x9fb4ff, accent: 0x8f9bff },
  midnight: { top: 0x06122a, bottom: 0x030916, rocks: 0x0b1a33, rays: 0.0, dark: 0.86, snow: 0x5fe0c8, accent: 0x39e6c9 },
  abyss:    { top: 0x07030f, bottom: 0x010003, rocks: 0x160a22, rays: 0.0, dark: 0.94, snow: 0xff6fb5, accent: 0xff4fa3 },
};

const KEYS = ["top", "bottom", "rocks", "snow", "accent"];

function mixColor(a, b, t) {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

// zones = [{id, name, from}, ...] from the server. Returns a blended look
// for this exact depth, plus which zone you're in.
export function lookAtDepth(depth, zones) {
  let i = 0;
  zones.forEach((z, idx) => { if (depth >= z.from) i = idx; });
  const here = ZONE_LOOK[zones[i].id];
  const nextZone = zones[i + 1];
  if (!nextZone) return { ...here, zoneIndex: i, zone: zones[i] };

  // Hold the zone's own colours for the first half, then blend toward the
  // next zone across the second half — so each zone has a clear identity.
  const span = nextZone.from - zones[i].from;
  const progress = (depth - zones[i].from) / span;
  const t = Math.max(0, Math.min(1, (progress - 0.5) / 0.5));
  const next = ZONE_LOOK[nextZone.id];
  const look = { zoneIndex: i, zone: zones[i] };
  for (const k of KEYS) look[k] = mixColor(here[k], next[k], t);
  look.rays = here.rays + (next.rays - here.rays) * t;
  look.dark = here.dark + (next.dark - here.dark) * t;
  return look;
}

export function hexToCss(n) {
  return `#${n.toString(16).padStart(6, "0")}`;
}
