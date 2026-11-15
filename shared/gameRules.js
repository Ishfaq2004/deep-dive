// shared/gameRules.js
//
// THE RULEBOOK. Every number that decides who wins lives here, on the
// server side, in one file:
//   - where the four ocean zones start, and how fast oxygen drains in each
//   - where the puzzle gates sit
//   - what a coin, a bubble, a sting or a wrong answer is worth
//   - the anti-cheat limits (how fast a diver can possibly descend, etc.)
//
// The browser never decides any of this. At the start of every run,
// game-service sends the parts the client needs to DRAW the world (zone
// depths, gate depths) inside RUN_STARTED, so the client is configured BY
// the server instead of keeping its own copy that could drift out of sync.
// One source of truth = low coupling: change a gate depth here, restart,
// and both the rules and the drawing follow.

// Real oceanography: these are the actual depth bands of the ocean's zones.
const ZONES = [
  { id: 'sunlight', name: 'Sunlight Zone', from: 0,    drainPerSec: 1.2, scoreMult: 1 },
  { id: 'twilight', name: 'Twilight Zone', from: 200,  drainPerSec: 1.5, scoreMult: 2 },
  { id: 'midnight', name: 'Midnight Zone', from: 1000, drainPerSec: 1.8, scoreMult: 3 },
  { id: 'abyss',    name: 'The Abyss',     from: 4000, drainPerSec: 2.2, scoreMult: 5 },
];

// Gates: a puzzle you must solve to keep descending. One at each zone
// boundary (200, 1000, 4000), extra "pressure locks" in between, then one
// every 1000 m forever.
const GATES = { fixed: [200, 1000, 2000, 3000, 4000], every: 1000 };

function gateDepth(index) {
  if (index < GATES.fixed.length) return GATES.fixed[index];
  const last = GATES.fixed[GATES.fixed.length - 1];
  return last + (index - GATES.fixed.length + 1) * GATES.every;
}

function zoneIndexAt(depth) {
  let index = 0;
  ZONES.forEach((zone, i) => { if (depth >= zone.from) index = i; });
  return index;
}

const OXYGEN = {
  start: 100,
  startStormy: 90,      // real stormy seas at the dive site = a harder start
  max: 100,
  bubble: 8,
  wrongAnswer: 15,
  gateReward: 35,
  chestReward: 15,
  airTank: 25,
};

// Damage per hazard kind. The client reports a hit; the server decides
// what it costs.
const HAZARDS = { jelly: 12, puffer: 15, angler: 20, urchin: 15 };

const SCORE = {
  coin: 10,              // x combo x zone multiplier
  perMeter: 1,           // x zone multiplier, only for NEW max depth
  gate: 150,             // x zone multiplier of the zone you unlock
  chest: 75,
  chestTreasure: 25,     // a solved chest pays 25 extra coins
  maxCombo: 5,
  comboWindowMs: 2000,   // collect the next coin within 2 s to keep the combo
};

// Anti-cheat ("trust, but verify"). Generous enough that a real player
// never hits them; tight enough that a tampered client can't fake a 5 km
// dive in two seconds.
const LIMITS = {
  maxMetersPerSec: 60,   // the diver's real top speed is ~45 m/s with a dash
  maxCollectsPerSec: 12,
  chunkMeters: 60,       // the world is generated in 60 m slices ("chunks")
  hitCooldownMs: 900,    // matches the client's invulnerability blink
};

const POWERUP_EFFECTS = { timeFreezeMs: 5000, sonarMs: 2500 };

const TICK_MS = 250;     // the server's heartbeat: 4 oxygen updates a second

// What the client needs to draw the world. Sent inside RUN_STARTED.
function clientRules() {
  return {
    zones: ZONES.map(({ id, name, from }) => ({ id, name, from })),
    gates: GATES,
    chunkMeters: LIMITS.chunkMeters,
  };
}

module.exports = {
  ZONES, GATES, OXYGEN, HAZARDS, SCORE, LIMITS, POWERUP_EFFECTS, TICK_MS,
  gateDepth, zoneIndexAt, clientRules,
};
