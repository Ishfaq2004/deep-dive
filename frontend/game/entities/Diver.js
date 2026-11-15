// game/entities/Diver.js
//
// The player. A Sprite (a picture that can move) with an Arcade Physics
// body (an invisible box the physics engine pushes around).
//
// The whole "swimming" feel is three forces, added up every frame:
//   1. your keys       -> acceleration in the direction you press
//   2. water drag      -> speed bleeds away when you let go (damping)
//   3. the ocean       -> a gentle sink, plus the REAL current at the dive site
// We never set the diver's position directly. We push, and the physics
// engine works out where it ends up. That's why it feels like water and not
// like a cursor.

import Phaser from "phaser";
import { DIVER, CURRENT_ACCEL } from "../config";

export class Diver extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "diver", 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(10);
    this.play("swim");
    this.body.setSize(70, 26).setOffset(28, 18);
    this.body.setCollideWorldBounds(true);
    this.body.setDamping(true);        // drag = "fraction of speed kept per second"
    this.body.setDrag(DIVER.drag, DIVER.drag);
    this.body.setMaxSpeed(DIVER.maxSpeed);
    this.body.setGravityY(DIVER.sink);

    this.invulnerableUntil = 0;
    this.dashUntil = 0;
    this.dashReadyAt = 0;
    this.facing = 1; // 1 = right, -1 = left
  }

  // input = { x: -1..1, y: -1..1, dash: bool }, drift = -1..1 from the real sea
  steer(input, drift, now) {
    const body = this.body;
    let { x, y } = input;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; } // diagonals aren't faster

    const dashing = now < this.dashUntil;
    if (input.dash && now >= this.dashReadyAt && len > 0) {
      this.dashUntil = now + DIVER.dashMs;
      this.dashReadyAt = now + DIVER.dashCooldownMs;
      body.setMaxSpeed(DIVER.dashSpeed);
      body.setVelocity(x * DIVER.dashSpeed, y * DIVER.dashSpeed);
      this.emit("dash");
    } else if (!dashing && body.maxSpeed !== DIVER.maxSpeed) {
      body.setMaxSpeed(DIVER.maxSpeed);
    }

    body.setAcceleration(x * DIVER.accel + drift * CURRENT_ACCEL, y * DIVER.accel);

    // Face where you're going. Rotate toward the velocity, and mirror the
    // sprite when swimming left so the diver is never upside down.
    const speed = body.speed;
    if (speed > 25) {
      if (Math.abs(body.velocity.x) > 20) this.facing = body.velocity.x < 0 ? -1 : 1;
      const angle = Math.atan2(body.velocity.y, Math.abs(body.velocity.x));
      const target = this.facing === 1 ? angle : -angle;
      this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, target, 0.12);
    }
    this.setFlipX(this.facing === -1);
    // Kick faster the faster you swim.
    this.anims.timeScale = 0.6 + Math.min(speed / DIVER.maxSpeed, 1.6);
  }

  get dashCooldown() {
    const left = this.dashReadyAt - this.scene.time.now;
    return Math.max(0, Math.min(1, left / DIVER.dashCooldownMs));
  }

  // Returns true if the hit "landed" (we weren't already blinking).
  hurt(fromX, fromY, now) {
    if (now < this.invulnerableUntil) return false;
    this.invulnerableUntil = now + DIVER.invulnMs;
    const away = new Phaser.Math.Vector2(this.x - fromX, this.y - fromY).normalize();
    this.body.setVelocity(away.x * DIVER.knockback, away.y * DIVER.knockback);
    this.scene.tweens.add({
      targets: this, alpha: 0.25, duration: 90, yoyo: true, repeat: 4,
      onComplete: () => this.setAlpha(1),
    });
    return true;
  }
}
