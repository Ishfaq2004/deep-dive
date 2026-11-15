// game/systems/Juice.js
//
// "Juice" = the feedback that makes an action FEEL good. None of this
// changes the rules; take it all out and the game still works. Put it in and
// every coin, sting and gate lands with weight. The classic toolkit:
//
//   screen shake   — the camera jolts on impact
//   hit-stop       — the world freezes for ~60 ms when you get hit
//   flash          — the whole screen tints for a blink
//   popups         — "+30 x3" floats up from where it happened
//   particle burst — sparks fly out of a collected coin

export class Juice {
  constructor(scene) {
    this.scene = scene;
    this.burst = scene.add.particles(0, 0, "spark", {
      emitting: false,
      speed: { min: 60, max: 260 },
      lifespan: { min: 300, max: 650 },
      scale: { start: 0.55, end: 0 },
      blendMode: "ADD",
    }).setDepth(40);
  }

  sparkle(x, y, color, count = 14) {
    this.burst.particleTint = color;
    this.burst.emitParticleAt(x, y, count);
  }

  popup(x, y, text, color = "#f2b84b", size = 22) {
    const label = this.scene.add.text(x, y, text, {
      fontFamily: "IBM Plex Mono, monospace",
      fontSize: `${size}px`,
      fontStyle: "bold",
      color,
      stroke: "#020814",
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(50);
    this.scene.tweens.add({
      targets: label, y: y - 70, alpha: 0, scale: 1.25, duration: 900, ease: "Cubic.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  shake(intensity = 0.01, ms = 180) {
    this.scene.cameras.main.shake(ms, intensity);
  }

  flash(r, g, b, ms = 140) {
    this.scene.cameras.main.flash(ms, r, g, b, false);
  }

  hitStop(ms = 70) {
    const physics = this.scene.physics.world;
    if (physics.isPaused) return;
    physics.pause();
    this.scene.time.delayedCall(ms, () => {
      if (!this.scene.puzzleOpen && !this.scene.ended) physics.resume();
    });
  }
}
