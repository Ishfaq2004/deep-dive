// game/scenes/BootScene.js
//
// Runs once, when the game first loads. Its jobs:
//   1. draw every texture (textures.js) and register the swim animation
//   2. tell the page "the game is ready" through the bus
//   3. show a calm, moving ocean behind the briefing screen while you wait
//
// A Phaser game is a stack of SCENES — think "pages" of the game. Each has
// the same lifecycle: init(data) -> preload() -> create() -> update() every
// frame. BootScene is the loading page; DiveScene is the game itself.

import Phaser from "phaser";
import { makeTextures } from "../textures";
import { Background } from "../systems/Background";
import { EVT } from "../bus";

const PREVIEW_ZONES = [
  { id: "sunlight", from: 0 }, { id: "twilight", from: 200 },
  { id: "midnight", from: 1000 }, { id: "abyss", from: 4000 },
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create() {
    makeTextures(this);
    this.anims.create({
      key: "swim",
      frames: [0, 1, 2, 3].map((frame) => ({ key: "diver", frame })),
      frameRate: 10,
      repeat: -1,
    });

    this.background = new Background(this, PREVIEW_ZONES);
    this.registry.get("bus").emit(EVT.READY);
  }

  update(time) {
    // Slowly "sink" the preview camera so the briefing screen feels alive.
    this.cameras.main.scrollY = time / 25;
    this.background.update(40, time);
  }
}
