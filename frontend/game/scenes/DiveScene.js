// game/scenes/DiveScene.js
//
// The game itself. If you read one file to understand the game, read this.
//
// Shape of the file — the same shape as almost every game scene ever:
//   create()  — build the world once: background, diver, groups, collisions
//   update()  — runs ~60 times a second: read keys, move things, repaint
//   on...()   — what happens when two things touch (collision callbacks)
//   bus listeners — what to SHOW when the server says something
//
// What this scene does NOT do: decide scores, oxygen, or whether a gate is
// open. It reports what it saw to the bus, and it draws what the server
// decided. It is the eyes and hands, never the referee.

import Phaser from "phaser";
import {
  GAME_W, GAME_H, PX_PER_METER, SURFACE_Y, PLAY_LEFT, PLAY_RIGHT,
  CHUNK_PX, DEPTH_REPORT_MS, CAMERA_LOOKAHEAD, MAGNET, HEADLAMP,
} from "../config";
import { EVT } from "../bus";
import { Diver } from "../entities/Diver";
import { spawnHazard, think } from "../entities/hazards";
import { generateChunk } from "../world/ChunkGenerator";
import { Background } from "../systems/Background";
import { Darkness } from "../systems/Darkness";
import { Juice } from "../systems/Juice";
import { sfx, toggleMute } from "../sfx";

// Same formula as the server's shared/gameRules.js gateDepth(), fed by the
// numbers the server sent — so the two can't disagree.
export function gateDepthAt(gates, index) {
  if (index < gates.fixed.length) return gates.fixed[index];
  return gates.fixed[gates.fixed.length - 1] + (index - gates.fixed.length + 1) * gates.every;
}

export class DiveScene extends Phaser.Scene {
  constructor() {
    super("DiveScene");
  }

  // init() receives the data passed to scene.start(): the server's RUN_STARTED.
  init(run) {
    this.run = run;
    this.bus = this.registry.get("bus");
  }

  create() {
    const { seed, rules, conditions, state } = this.run;
    this.seed = seed;
    this.rules = rules;
    this.drift = conditions.driftX;
    this.gatesOpened = state.gatesOpened;
    this.oxygen = state.oxygen;
    this.taken = new Set();     // ids already collected, so rebuilt chunks skip them
    this.chunks = new Map();    // chunkIndex -> { objects, schools }
    this.gateObjs = new Map();  // gateIndex -> { wall, tile, core, labels }
    this.puzzleOpen = false;
    this.ended = false;
    this.frozenUntil = 0;
    this.lastCoinAt = 0;
    this.combo = 0;
    this.nextTrailAt = 0;
    this.nextBeatAt = 0;
    this.lastGateTouch = 0;
    this.activeChest = null;

    // World + camera. The world is as wide as the screen and ~infinitely deep.
    this.physics.world.setBounds(PLAY_LEFT, SURFACE_Y + 30, PLAY_RIGHT - PLAY_LEFT, 1e8);
    this.cameras.main.setBounds(0, SURFACE_Y - 10, GAME_W, 1e8); // never look above the surface

    this.background = new Background(this, rules.zones);
    this.juice = new Juice(this);

    // Groups: one bucket per kind of thing, so a single overlap rule covers
    // every coin at once instead of one rule per coin.
    this.coins = this.physics.add.group({ allowGravity: false });
    this.bubbles = this.physics.add.group({ allowGravity: false });
    this.chests = this.physics.add.group({ allowGravity: false });
    this.hazards = this.physics.add.group({ allowGravity: false });
    this.gates = this.physics.add.staticGroup();
    this.schools = [];

    this.diver = new Diver(this, GAME_W / 2, 90);
    this.diver.on("dash", () => {
      sfx.dash();
      this.juice.sparkle(this.diver.x, this.diver.y, 0x9ff3ff, 10);
    });

    // The camera follows the diver smoothly (lerp 0.1 = "move 10% of the way
    // each frame") and sits a bit BELOW it, so you see what's coming.
    this.cameras.main.startFollow(this.diver, false, 0.1, 0.1, 0, -CAMERA_LOOKAHEAD);

    this.trail = this.add.particles(0, 0, "spark", {
      emitting: false, lifespan: 1300, speedY: { min: -70, max: -30 }, speedX: { min: -15, max: 15 },
      scale: { start: 0.28, end: 0.05 }, alpha: { start: 0.7, end: 0 }, blendMode: "ADD",
    }).setDepth(9);
    this.dashRing = this.add.graphics().setDepth(11);

    this.darkness = new Darkness(this, HEADLAMP[conditions.visibility] || HEADLAMP.clear);
    this.freezeTint = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x6fd3ff, 0).setOrigin(0).setScrollFactor(0).setDepth(35);

    // Collision rules. "overlap" = they pass through each other but we get a
    // callback; "collider" = the physics engine stops them going through.
    this.physics.add.overlap(this.diver, this.coins, (d, coin) => this.onCoin(coin));
    this.physics.add.overlap(this.diver, this.bubbles, (d, bubble) => this.onBubble(bubble));
    this.physics.add.overlap(this.diver, this.chests, (d, chest) => this.onChest(chest));
    this.physics.add.overlap(this.diver, this.hazards, (d, hazard) => this.onHazard(hazard));
    this.physics.add.collider(this.diver, this.gates, (d, wall) => this.onGate(wall));

    this.setupKeys();
    this.listen();

    // Tell the server our depth 5 times a second.
    this.time.addEvent({ delay: DEPTH_REPORT_MS, loop: true, callback: () => this.bus.emit(EVT.DEPTH, { depth: this.depth }) });
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.ensureChunks() });
    this.ensureChunks();

    if (typeof window !== "undefined") window.__deepDive = this; // handy in the browser console
  }

  get depth() {
    return Math.max(0, Math.round((this.diver.y - SURFACE_Y) / PX_PER_METER));
  }

  // --- Input ---------------------------------------------------------------

  setupKeys() {
    const kb = this.input.keyboard;
    this.keys = kb.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,Q,E,F,M,G,ESC");
    this.keys.Q.on("down", () => this.requestPowerup("air_tank"));
    this.keys.E.on("down", () => this.requestPowerup("time_freeze"));
    this.keys.F.on("down", () => (this.scale.isFullscreen ? this.scale.stopFullscreen() : this.scale.startFullscreen()));
    this.keys.M.on("down", () => this.juice.popup(this.diver.x, this.diver.y - 50, toggleMute() ? "sound off" : "sound on", "#9fb9ce", 16));
    this.keys.ESC.on("down", () => this.bus.emit(EVT.SURFACE));
    this.keys.G.on("down", () => this.toggleHitboxes());
  }

  readInput() {
    const k = this.keys;
    return {
      x: (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0),
      y: (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0),
      dash: Phaser.Input.Keyboard.JustDown(k.SPACE),
    };
  }

  requestPowerup(powerupId) {
    if (this.ended || this.puzzleOpen) return;
    this.bus.emit(EVT.POWERUP, { powerupId });
  }

  // Press G: draw every physics body as a box. The best way to SEE what the
  // physics engine actually thinks the world looks like.
  toggleHitboxes() {
    const world = this.physics.world;
    if (!world.debugGraphic) world.createDebugGraphic();
    world.drawDebug = !world.drawDebug;
    if (!world.drawDebug) world.debugGraphic.clear();
  }

  // --- Listening to the server (via the bus) --------------------------------

  listen() {
    const on = (event, fn) => this.bus.on(event, fn);
    const offs = [
      on(EVT.NET_STATE, (s) => {
        this.oxygen = s.oxygen;
        this.gatesOpened = Math.max(this.gatesOpened, s.gatesOpened);
      }),
      on(EVT.NET_COLLECTED, (m) => {
        if (m.kind === "coin") {
          this.combo = m.combo;
          this.juice.popup(this.diver.x, this.diver.y - 40, m.combo > 1 ? `+${m.points} ×${m.combo}` : `+${m.points}`);
        } else {
          this.juice.popup(this.diver.x, this.diver.y - 40, `+${m.oxygenGain} O₂`, "#9ff3ff");
        }
      }),
      on(EVT.NET_HIT, (m) => this.juice.popup(this.diver.x, this.diver.y - 40, `−${m.damage} O₂`, "#ff6b5b", 24)),
      on(EVT.NET_GATE_OPENED, (m) => this.openGate(m.gateIndex)),
      on(EVT.NET_ZONE, () => {
        sfx.zone();
        this.juice.flash(20, 40, 90, 600);
      }),
      on(EVT.NET_ANSWER, (m) => this.showAnswer(m)),
      on(EVT.NET_POWERUP, (m) => this.showPowerup(m)),
      on(EVT.PUZZLE_OPEN, () => this.setPuzzleOpen(true)),
      on(EVT.PUZZLE_CLOSE, () => this.setPuzzleOpen(false)),
      on(EVT.NET_ENDED, () => this.endRun()),
    ];
    // When this scene stops (game over -> dive again), unsubscribe, or the
    // next run would hear every message twice.
    this.events.once("shutdown", () => offs.forEach((off) => off()));
  }

  setPuzzleOpen(open) {
    this.puzzleOpen = open;
    this.input.keyboard.enabled = !open; // let the puzzle's text box have the keys
    if (open) {
      this.physics.pause();
      this.diver.anims.pause();
    } else if (!this.ended) {
      this.physics.resume();
      this.diver.anims.resume();
      this.input.keyboard.resetKeys();
    }
  }

  showAnswer(m) {
    if (m.correct) sfx.correct(); else sfx.wrong();
    if (m.context === "chest" && this.activeChest?.active) {
      const chest = this.activeChest;
      if (m.correct) {
        this.juice.sparkle(chest.x, chest.y, 0xf2b84b, 40);
        this.juice.popup(chest.x, chest.y - 30, `+${m.reward.coins} coins`, "#f2b84b", 26);
      } else {
        chest.setTint(0x555555);
      }
      this.tweens.add({ targets: chest, alpha: 0, scale: 0.4, duration: 500, delay: 300, onComplete: () => chest.destroy() });
      this.activeChest = null;
    }
    if (!m.correct) this.juice.shake(0.008, 220);
  }

  showPowerup(m) {
    sfx.powerup();
    if (m.powerupId === "air_tank") {
      this.juice.sparkle(this.diver.x, this.diver.y, 0x9ff3ff, 36);
      this.juice.popup(this.diver.x, this.diver.y - 50, `+${m.oxygen} O₂`, "#9ff3ff", 26);
    } else if (m.powerupId === "time_freeze") {
      this.frozenUntil = this.time.now + m.forMs;
      this.freezeTint.setFillStyle(0x6fd3ff, 0.12);
      this.time.delayedCall(m.forMs, () => this.freezeTint.setFillStyle(0x6fd3ff, 0));
    }
  }

  endRun() {
    this.ended = true;
    this.physics.pause();
    this.diver.anims.pause();
    this.tweens.add({ targets: this.diver, alpha: 0.35, duration: 800 });
  }

  // --- The infinite ocean -----------------------------------------------------
  // Only the slices near the camera exist. Below: built just before you see
  // them. Far above: destroyed. Same idea as Minecraft's chunks.

  gateDepthsBetween(topPx, bottomPx) {
    const out = [];
    for (let i = 0; ; i++) {
      const d = gateDepthAt(this.rules.gates, i);
      const y = d * PX_PER_METER;
      if (y > bottomPx) break;
      if (y >= topPx) out.push(d);
    }
    return out;
  }

  ensureChunks() {
    const cam = this.cameras.main;
    const first = Math.max(0, Math.floor((cam.scrollY - CHUNK_PX) / CHUNK_PX));
    const last = Math.floor((cam.scrollY + GAME_H + CHUNK_PX * 1.5) / CHUNK_PX);
    for (let i = first; i <= last; i++) if (!this.chunks.has(i)) this.buildChunk(i);
    for (const i of [...this.chunks.keys()]) if (i < first - 1 || i > last + 1) this.destroyChunk(i);

    // Gates the server hasn't seen opened yet, within range.
    for (let g = this.gatesOpened; ; g++) {
      const y = gateDepthAt(this.rules.gates, g) * PX_PER_METER;
      if (y > (last + 1) * CHUNK_PX) break;
      if (!this.gateObjs.has(g)) this.buildGate(g);
    }
  }

  buildChunk(index) {
    const spec = generateChunk(this.seed, index, {
      zones: this.rules.zones,
      gateDepths: this.gateDepthsBetween(index * CHUNK_PX - 200, (index + 1) * CHUNK_PX + 200),
    });
    const objects = [];
    const add = (sprite) => { objects.push(sprite); return sprite; };

    spec.coins.filter((c) => !this.taken.has(c.id)).forEach((c) => {
      const coin = add(this.coins.create(c.x, c.y, "coin").setDepth(7));
      coin.itemId = c.id;
      coin.body.setCircle(13, 7, 7);
      // A spinning coin is just its width squashing to 25% and back.
      this.tweens.add({ targets: coin, scaleX: 0.25, duration: 420, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: (c.x + c.y) % 400 });
    });
    spec.bubbles.filter((b) => !this.taken.has(b.id)).forEach((b) => {
      const bubble = add(this.bubbles.create(b.x, b.y, "bubble").setDepth(7));
      bubble.itemId = b.id;
      bubble.body.setCircle(17, 7, 7);
      this.tweens.add({ targets: bubble, y: b.y - 14, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    });
    spec.chests.filter((k) => !this.taken.has(k.id)).forEach((k) => {
      const chest = add(this.chests.create(k.x, k.y, "chest").setDepth(7));
      chest.itemId = k.id;
      chest.body.setSize(52, 40);
      this.tweens.add({ targets: chest, y: k.y - 8, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    });
    spec.hazards.forEach((h) => add(spawnHazard(this, this.hazards, h)));

    const schools = spec.schools.map((s) => {
      const fish = Array.from({ length: s.count }, (_, i) =>
        this.add.image(Phaser.Math.Between(0, GAME_W), s.y + Math.sin(i * 1.7) * 30 + (i % 3) * 12, "fish")
          .setTint(s.tint).setAlpha(0.75).setScale(0.7 + (i % 3) * 0.15).setFlipX(s.dir < 0).setDepth(5)
      );
      return { fish, dir: s.dir, x: Phaser.Math.Between(0, GAME_W) };
    });
    schools.forEach((s) => s.fish.forEach((f, i) => (f.x = s.x + i * 26 * -s.dir)));
    this.schools.push(...schools);
    this.chunks.set(index, { objects, schools });
  }

  destroyChunk(index) {
    const chunk = this.chunks.get(index);
    chunk.objects.forEach((o) => { if (o.active) { this.tweens.killTweensOf(o); o.destroy(); } });
    chunk.schools.forEach((s) => s.fish.forEach((f) => f.destroy()));
    this.schools = this.schools.filter((s) => !chunk.schools.includes(s));
    this.chunks.delete(index);
  }

  buildGate(index) {
    const depthM = gateDepthAt(this.rules.gates, index);
    const y = depthM * PX_PER_METER;
    const zoneAhead = this.rules.zones.find((z) => z.from === depthM);
    const wall = this.gates.create(GAME_W / 2, y, "white").setDisplaySize(GAME_W, 40).setVisible(false).refreshBody();
    wall.gateIndex = index;
    const tile = this.add.tileSprite(GAME_W / 2, y, GAME_W, 56, "gateTile").setDepth(9).setBlendMode("ADD");
    const core = this.add.image(GAME_W / 2, y, "gateCore").setDepth(9).setScale(0.75);
    this.tweens.add({ targets: core, angle: 360, duration: 9000, repeat: -1 });
    this.tweens.add({ targets: tile, alpha: 0.6, duration: 900, yoyo: true, repeat: -1 });
    const title = zoneAhead ? `ZONE GATE · ${zoneAhead.name.toUpperCase()} AHEAD` : `PRESSURE LOCK · ${depthM} m`;
    const labels = [
      this.add.text(GAME_W / 2, y - 92, title, { fontFamily: "IBM Plex Mono, monospace", fontSize: "18px", fontStyle: "bold", color: "#8cffeb", stroke: "#020814", strokeThickness: 5 }).setOrigin(0.5).setDepth(9),
      this.add.text(GAME_W / 2, y - 68, "swim into the lock · count the fish to open it", { fontFamily: "IBM Plex Mono, monospace", fontSize: "13px", color: "#cfe8f5", stroke: "#020814", strokeThickness: 4 }).setOrigin(0.5).setDepth(9),
    ];
    this.gateObjs.set(index, { wall, tile, core, labels });
  }

  openGate(index) {
    const gate = this.gateObjs.get(index);
    this.gatesOpened = Math.max(this.gatesOpened, index + 1);
    if (!gate) return;
    const y = gate.wall.y;
    sfx.gate();
    this.juice.flash(57, 230, 201, 300);
    this.juice.shake(0.006, 300);
    for (let x = 80; x < GAME_W; x += 80) this.juice.sparkle(x, y, 0x8cffeb, 6);
    gate.wall.destroy();
    this.tweens.killTweensOf([gate.tile, gate.core]);
    this.tweens.add({ targets: gate.tile, scaleY: 0, alpha: 0, duration: 500, onComplete: () => gate.tile.destroy() });
    this.tweens.add({ targets: gate.core, scale: 2.2, alpha: 0, duration: 700, onComplete: () => gate.core.destroy() });
    this.tweens.add({ targets: gate.labels, alpha: 0, y: "-=30", duration: 500, onComplete: () => gate.labels.forEach((l) => l.destroy()) });
    this.juice.popup(GAME_W / 2, y - 40, "LOCK OPEN", "#8cffeb", 30);
    this.gateObjs.delete(index);
  }

  // --- Touch callbacks ----------------------------------------------------------
  // The client reacts INSTANTLY (sound, sparkle, the coin vanishes) so it
  // feels responsive, and tells the server. The score popup waits for the
  // server's answer, a few milliseconds later.

  onCoin(coin) {
    if (coin.taken) return;
    coin.taken = true;
    this.taken.add(coin.itemId);
    this.bus.emit(EVT.COIN, { id: coin.itemId });
    // Predict the combo for the sound's pitch (the server confirms it).
    const now = this.time.now;
    const predicted = now - this.lastCoinAt <= 2000 ? Math.min(this.combo + 1, 5) : 1;
    this.combo = predicted;
    this.lastCoinAt = now;
    sfx.coin(predicted);
    this.juice.sparkle(coin.x, coin.y, 0xf2b84b, 10);
    this.tweens.killTweensOf(coin);
    coin.destroy();
  }

  onBubble(bubble) {
    if (bubble.taken) return;
    bubble.taken = true;
    this.taken.add(bubble.itemId);
    this.bus.emit(EVT.BUBBLE, { id: bubble.itemId });
    sfx.bubble();
    this.juice.sparkle(bubble.x, bubble.y, 0x9ff3ff, 16);
    this.tweens.killTweensOf(bubble);
    bubble.destroy();
  }

  onChest(chest) {
    if (chest.used || this.puzzleOpen || this.ended) return;
    chest.used = true;
    this.taken.add(chest.itemId);
    this.activeChest = chest;
    this.tweens.killTweensOf(chest);
    sfx.chest();
    this.bus.emit(EVT.CHEST, { chestId: chest.itemId });
  }

  onHazard(hazard) {
    if (this.puzzleOpen || this.ended) return;
    if (!this.diver.hurt(hazard.x, hazard.y, this.time.now)) return;
    this.bus.emit(EVT.HIT, { kind: hazard.kind });
    sfx.hit();
    this.juice.shake(0.014, 220);
    this.juice.flash(255, 70, 70, 120);
    this.juice.hitStop(70);
  }

  onGate(wall) {
    if (this.puzzleOpen || this.ended) return;
    const now = this.time.now;
    if (now - this.lastGateTouch < 1500) return;
    this.lastGateTouch = now;
    this.bus.emit(EVT.GATE, { gateIndex: wall.gateIndex });
    const gate = this.gateObjs.get(wall.gateIndex);
    if (gate) this.tweens.add({ targets: gate.core, scale: 0.95, duration: 120, yoyo: true });
  }

  // --- Every frame ----------------------------------------------------------------

  update(time, delta) {
    const dt = delta / 1000;
    const diver = this.diver;
    const frozen = time < this.frozenUntil;

    if (!this.puzzleOpen && !this.ended) diver.steer(this.readInput(), this.drift, time);

    const live = !this.puzzleOpen && !this.ended;
    this.hazards.children.iterate((h) => { if (h) think(h, diver, time, dt, frozen || !live); });

    // Coin magnet: close coins drift toward you, stronger the closer they are.
    if (live) {
      this.coins.children.iterate((c) => {
        if (!c || c.taken) return;
        const dx = diver.x - c.x, dy = diver.y - c.y, d = Math.hypot(dx, dy);
        if (d < MAGNET.radius && d > 1) {
          const pull = MAGNET.pull * (1 - d / MAGNET.radius) * dt;
          c.x += (dx / d) * pull;
          c.y += (dy / d) * pull;
        }
      });
    }

    // Breathing bubbles from the regulator.
    if (live && time > this.nextTrailAt) {
      this.nextTrailAt = time + 120;
      this.trail.emitParticleAt(diver.x + diver.facing * 34, diver.y - 10, 1);
    }

    // Decorative schools swim and wrap around the screen.
    for (const s of this.schools) {
      for (const f of s.fish) {
        f.x += s.dir * 55 * dt;
        if (s.dir > 0 && f.x > GAME_W + 40) f.x = -40;
        if (s.dir < 0 && f.x < -40) f.x = GAME_W + 40;
      }
    }

    // Dash cooldown ring around the diver.
    this.dashRing.clear();
    const cd = diver.dashCooldown;
    if (cd > 0) {
      this.dashRing.lineStyle(3, 0x9ff3ff, 0.6);
      this.dashRing.beginPath();
      this.dashRing.arc(diver.x, diver.y, 40, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cd));
      this.dashRing.strokePath();
    }

    const depth = this.depth;
    this.background.update(depth, time);
    this.darkness.update(this.background.look.dark, diver, this.collectLights(), time);

    // Low oxygen: a heartbeat you can hear.
    if (live && this.oxygen < 25 && time > this.nextBeatAt) {
      this.nextBeatAt = time + 900;
      sfx.heartbeat();
    }
  }

  // Everything that glows in the dark.
  collectLights() {
    const lights = [];
    const top = this.cameras.main.scrollY - 150;
    const bottom = top + GAME_H + 300;
    const inView = (o) => o.active && o.y > top && o.y < bottom;
    this.hazards.children.iterate((h) => {
      if (!h || !inView(h)) return;
      if (h.kind === "jelly") lights.push({ x: h.x, y: h.y, r: 80 });
      if (h.kind === "angler") lights.push({ x: h.x + (h.flipX ? -52 : 52), y: h.y - 30, r: 70 });
      if (h.kind === "urchin") lights.push({ x: h.x, y: h.y, r: 50 });
      if (h.kind === "puffer") lights.push({ x: h.x, y: h.y, r: 45 });
    });
    this.coins.children.iterate((c) => { if (c && inView(c)) lights.push({ x: c.x, y: c.y, r: 30 }); });
    this.bubbles.children.iterate((b) => { if (b && inView(b)) lights.push({ x: b.x, y: b.y, r: 40 }); });
    this.chests.children.iterate((k) => { if (k && inView(k)) lights.push({ x: k.x, y: k.y, r: 70 }); });
    for (const gate of this.gateObjs.values()) {
      if (gate.wall.y < top || gate.wall.y > bottom) continue;
      lights.push({ x: GAME_W / 2, y: gate.wall.y, r: 170 });
      for (let x = 160; x < GAME_W; x += 240) lights.push({ x, y: gate.wall.y, r: 90 });
      lights.push({ x: GAME_W / 2, y: gate.wall.y - 80, r: 120 }); // so the label is readable
    }
    return lights;
  }
}
