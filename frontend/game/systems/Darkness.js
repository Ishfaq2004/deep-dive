// game/systems/Darkness.js
//
// The deep is dark, and the trick to drawing dark is: darkness is a LAYER,
// and light is a HOLE you cut in it.
//
// Every frame:
//   1. wipe the layer and fill it with near-black, at the zone's darkness
//   2. "erase" a soft circle where the diver's headlamp is
//   3. erase smaller circles where things glow on their own (jellyfish,
//      the angler's lure, coins) — that's bioluminescence
//
// The layer is a RenderTexture: an image you can draw into at runtime. It's
// glued to the screen (scrollFactor 0), so we convert world positions to
// screen positions before cutting.

import { GAME_W, GAME_H } from "../config";

export class Darkness {
  constructor(scene, headlampRadius) {
    this.scene = scene;
    this.radius = headlampRadius;
    this.layer = scene.add.renderTexture(0, 0, GAME_W, GAME_H).setOrigin(0).setScrollFactor(0).setDepth(30);
    this.brush = scene.make.image({ key: "light", add: false });
    this.flicker = 0;
  }

  // lights = [{ x, y, r }] in WORLD coordinates
  update(darkness, diver, lights, time) {
    const cam = this.scene.cameras.main;
    this.layer.clear();
    if (darkness <= 0.01) return;

    this.layer.fill(0x01040a, darkness);
    // A little flicker on the headlamp makes it feel like a real torch.
    const r = this.radius * (1 + Math.sin(time / 90) * 0.012);
    this.cut(diver.x - cam.scrollX, diver.y - cam.scrollY, r);
    for (const light of lights) {
      const sx = light.x - cam.scrollX;
      const sy = light.y - cam.scrollY;
      if (sx < -200 || sx > GAME_W + 200 || sy < -200 || sy > GAME_H + 200) continue;
      this.cut(sx, sy, light.r);
    }
  }

  cut(x, y, radius) {
    this.brush.setScale((radius * 2) / 256);
    this.layer.erase(this.brush, x, y);
  }
}
