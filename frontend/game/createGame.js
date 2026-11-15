// game/createGame.js
//
// The one function the React side calls to get a game. It builds the
// Phaser.Game (the engine: canvas, game loop, physics, input) and hands
// back a small "remote control" with just three buttons:
//   startDive(run) — (re)start the dive scene with the server's RUN_STARTED
//   destroy()      — tear the whole engine down when the page unmounts
//   game           — the raw engine, for debugging
//
// React never reaches into scenes or sprites. It presses these buttons, and
// talks to the scene through the bus. That's the boundary.

import Phaser from "phaser";
import { GAME_W, GAME_H } from "./config";
import { BootScene } from "./scenes/BootScene";
import { DiveScene } from "./scenes/DiveScene";

export function createGame(parent, bus) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,          // WebGL if the browser has it, Canvas otherwise
    parent,
    width: GAME_W,
    height: GAME_H,
    backgroundColor: "#020814",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, // fill any screen, keep the shape
    physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scene: [BootScene, DiveScene],
    callbacks: { preBoot: (g) => g.registry.set("bus", bus) },
  });

  return {
    game,
    startDive(run) {
      if (game.scene.isActive("BootScene")) game.scene.stop("BootScene");
      game.scene.start("DiveScene", run); // restarts it cleanly if it's already running
    },
    destroy() {
      game.destroy(true);
    },
  };
}
