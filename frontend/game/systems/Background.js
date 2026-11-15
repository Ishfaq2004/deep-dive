// game/systems/Background.js
//
// Everything BEHIND the action, in layers. Layers that move at different
// speeds ("parallax") are what make a flat screen feel deep:
//
//   layer            moves at          job
//   water gradient   0 (glued to the screen)   the zone's colour
//   light shafts     0, swaying        sunlight near the surface
//   far rock walls   30% of camera     distant cliffs, slow = far away
//   marine snow      100% (world)      drifting specks = you feel your speed
//   near rock walls  70% of camera     close cliffs, fast = right beside you
//
// Nothing here has physics or game logic. It only ever reads one number —
// the depth — and repaints.

import Phaser from "phaser";
import { GAME_W, GAME_H } from "../config";
import { lookAtDepth } from "../zones";

export class Background {
  constructor(scene, zones) {
    this.scene = scene;
    this.zones = zones;
    const cam = scene.cameras.main;

    this.water = scene.add.image(0, 0, "white").setOrigin(0).setDisplaySize(GAME_W, GAME_H).setScrollFactor(0).setDepth(-100);

    this.rays = [140, 360, 620, 860, 1100].map((x, i) =>
      scene.add.image(x, -40, "ray").setOrigin(0.5, 0).setScrollFactor(0).setDepth(-90)
        .setAngle(-14 + i * 6).setBlendMode("ADD").setScale(1 + (i % 2) * 0.5, 1.1)
    );

    this.wallsFar = scene.add.tileSprite(0, 0, GAME_W, GAME_H, "wallsFar").setOrigin(0).setScrollFactor(0).setDepth(-80);
    this.wallsNear = scene.add.tileSprite(0, 0, GAME_W, GAME_H, "wallsNear").setOrigin(0).setScrollFactor(0).setDepth(20);

    // Marine snow lives in WORLD space: as the camera sinks, the specks rise
    // past you. That rising motion is how your brain reads "I'm moving down".
    // The emitter itself never moves (moving it would drag every speck with
    // it); instead the rectangle it spawns inside follows the camera.
    this.snowZone = new Phaser.Geom.Rectangle(0, -GAME_H * 0.5, GAME_W, GAME_H * 2);
    this.snow = scene.add.particles(0, 0, "spark", {
      emitZone: { type: "random", source: this.snowZone },
      lifespan: 7000,
      speedY: { min: -6, max: 10 },
      speedX: { min: -6, max: 6 },
      scale: { min: 0.08, max: 0.22 },
      alpha: { start: 0.7, end: 0 },
      frequency: 45,
      blendMode: "ADD",
    }).setDepth(-70);

    this.surface = scene.add.tileSprite(0, -10, GAME_W, 80, "surface").setOrigin(0).setDepth(-60).setBlendMode("ADD");
    this.look = lookAtDepth(0, zones);
    this.cam = cam;
  }

  update(depth, time) {
    const look = lookAtDepth(depth, this.zones);
    this.look = look;
    const cam = this.cam;

    // 4-corner tint on one white image = a gradient for free.
    this.water.setTint(look.top, look.top, look.bottom, look.bottom);

    const sway = Math.sin(time / 2400);
    this.rays.forEach((ray, i) => {
      ray.setAlpha(look.rays * (0.6 + 0.4 * Math.sin(time / 1700 + i)));
      ray.x = 140 + i * 240 + sway * 30;
    });

    this.wallsFar.tilePositionY = cam.scrollY * 0.3;
    this.wallsNear.tilePositionY = cam.scrollY * 0.7;
    this.wallsFar.setTint(look.rocks);
    this.wallsNear.setTint(shade(look.rocks, 0.55));

    this.snowZone.y = cam.scrollY - GAME_H * 0.5;
    this.snow.particleTint = look.snow;
    this.surface.tilePositionX = time / 40;
  }
}

function shade(color, k) {
  const r = Math.round(((color >> 16) & 255) * k);
  const g = Math.round(((color >> 8) & 255) * k);
  const b = Math.round((color & 255) * k);
  return (r << 16) | (g << 8) | b;
}
