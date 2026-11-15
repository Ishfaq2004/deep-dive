// game/entities/hazards.js
//
// Game "AI" is mostly a few lines of maths per frame. Each creature has ONE
// behaviour — a tiny rule run every frame in think():
//
//   jelly  — DRIFT:  bob up and down on a sine wave, wander sideways
//   puffer — PATROL: swim left/right; puff up when the diver gets close
//   angler — SEEK:   idle until the diver is near, then hunt it, slowly
//   urchin — STATIC: sit still, rotate, punish careless steering
//
// Four behaviours, mixed by zone (see ChunkGenerator's DENSITY table), are
// enough to make every zone feel different to play.

import Phaser from "phaser";
import { PLAY_LEFT, PLAY_RIGHT } from "../config";

const SIZES = {
  jelly:  { body: [40, 50], offset: [16, 10] },
  puffer: { body: [44, 44], offset: [18, 14] },
  angler: { body: [80, 48], offset: [20, 26] },
  urchin: { body: [40, 40], offset: [16, 16] },
};

export function spawnHazard(scene, group, spec) {
  const sprite = group.create(spec.x, spec.y, spec.kind);
  const size = SIZES[spec.kind];
  sprite.body.setSize(size.body[0], size.body[1]).setOffset(size.offset[0], size.offset[1]);
  sprite.body.setAllowGravity(false);
  sprite.setDepth(8);
  sprite.kind = spec.kind;
  sprite.baseX = spec.x;
  sprite.baseY = spec.y;
  sprite.phase = spec.phase;
  sprite.speedMul = spec.speed;
  sprite.vx = (spec.phase > Math.PI ? 1 : -1) * 40 * spec.speed;
  return sprite;
}

// Called every frame for every live hazard. `frozen` = Time Freeze is on.
export function think(h, diver, time, dt, frozen) {
  if (frozen) { h.body.setVelocity(0, 0); return; }
  const t = time / 1000;
  const dx = diver.x - h.x;
  const dy = diver.y - h.y;
  const dist = Math.hypot(dx, dy);

  switch (h.kind) {
    case "jelly": {
      h.y = h.baseY + Math.sin(t * 1.3 * h.speedMul + h.phase) * 26;
      h.baseX += h.vx * 0.35 * dt;
      if (h.baseX < PLAY_LEFT + 60 || h.baseX > PLAY_RIGHT - 60) h.vx *= -1;
      h.x = h.baseX;
      h.setScale(1, 1 + Math.sin(t * 3 + h.phase) * 0.06); // the bell pulses
      break;
    }
    case "puffer": {
      h.x += h.vx * dt;
      if (h.x < PLAY_LEFT + 60 || h.x > PLAY_RIGHT - 60) h.vx *= -1;
      h.setFlipX(h.vx < 0);
      const target = dist < 170 ? 1.55 : 1; // puff up when threatened
      h.setScale(Phaser.Math.Linear(h.scale, target, 0.08));
      h.y = h.baseY + Math.sin(t * 2 + h.phase) * 8;
      break;
    }
    case "angler": {
      if (dist < 380) {
        // Hunt: steer toward the diver at up to 95 px/s.
        const speed = 95 * h.speedMul;
        h.body.setVelocity((dx / dist) * speed, (dy / dist) * speed);
      } else {
        h.body.setVelocity(Math.sin(t * 0.5 + h.phase) * 20, Math.cos(t * 0.7 + h.phase) * 12);
      }
      h.setFlipX(h.body.velocity.x < 0);
      break;
    }
    case "urchin": {
      h.rotation += 0.4 * dt;
      break;
    }
  }
}
