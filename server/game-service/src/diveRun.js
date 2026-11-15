// server/game-service/src/diveRun.js
//
// ONE live dive, on the server. This is the referee.
//
// The browser runs the fun part — swimming, physics, drawing at 60 frames a
// second. But the browser is a machine the player controls, so it is never
// trusted with anything that decides the result. It REPORTS what happened
// ("I picked up coin c:4:2", "I'm at 312 m", "a jellyfish stung me"), and
// this class decides what that's worth: oxygen, score, combo, whether a
// gate is open, whether the run is over.
//
// It's an EventEmitter, so it plays both roles from the Event-Driven
// Programming slides at once:
//   - Dispatcher: it emits domain events ('state', 'collected', 'gate:opened'...)
//   - Observable: server.js subscribes with run.on(...) and turns each event
//     into a WebSocket message. This class has never heard of WebSockets.
//     (Hollywood Principle: "don't call us, we'll call you.")

const { EventEmitter } = require('events');
const { randomUUID, randomInt } = require('crypto');
const challengeClient = require('./challengeClient');
const identityClient = require('./identityClient');
const conditionsClient = require('./conditionsClient');
const rules = require('../../../shared/gameRules');

const { ZONES, OXYGEN, HAZARDS, SCORE, LIMITS, POWERUP_EFFECTS, TICK_MS } = rules;

const ITEM_ID = /^([cbk]):(\d+):(\d+)$/; // coin / bubble / chest : chunk : index

class DiveRun extends EventEmitter {
  constructor(user, authToken) {
    super();
    this.id = randomUUID();
    this.user = user; // { id, username } — proven by the JWT at connect time
    this.authToken = authToken;
    this.seed = randomInt(1, 2 ** 31 - 1); // the client builds the SAME ocean from this

    this.oxygen = OXYGEN.start;
    this.score = 0;
    this.coins = 0;
    this.chestsOpened = 0;
    this.combo = 0;
    this.lastCoinAt = 0;

    this.depth = 0;          // last depth the client reported (after checks)
    this.maxDepth = 0;
    this.lastDepthAt = Date.now();
    this.zoneIndex = 0;
    this.gatesOpened = 0;    // gates are solved in order, so this is also "next gate index"

    this.collected = new Set(); // every item id this run has already paid for
    this.recentCollects = [];   // timestamps, for the rate limit
    this.lastHitAt = 0;

    this.challenge = null;   // { challengeId, context: 'gate'|'chest', gateIndex?, chestId? }
    this.busy = false;       // true while waiting on challenge-service
    this.frozenUntil = 0;
    this.conditions = null;
    this.startedAt = Date.now();
    this.ended = false;
    this.flags = 0;          // how many reports we had to reject (anti-cheat log)
    this._tick = null;
  }

  // --- Lifecycle -------------------------------------------------------------

  async start() {
    this.conditions = await conditionsClient.getDiveConditions();
    if (this.conditions.visibility === 'stormy') this.oxygen = OXYGEN.startStormy;
    this.startedAt = Date.now();
    this.lastDepthAt = Date.now();
    this.emit('run:started', {
      runId: this.id,
      seed: this.seed,
      conditions: this.conditions,
      rules: rules.clientRules(),
      state: this.snapshot(),
    });
    this._tick = setInterval(() => this._onTick(), TICK_MS);
  }

  _onTick() {
    if (this.ended) return;
    const frozen = Date.now() < this.frozenUntil;
    if (!frozen) {
      const drain = ZONES[this.zoneIndex].drainPerSec * (TICK_MS / 1000);
      this.oxygen = Math.max(0, this.oxygen - drain);
    }
    this.emit('state', this.snapshot());
    if (this.oxygen <= 0) this._end('oxygen_empty');
  }

  snapshot() {
    return {
      oxygen: Math.round(this.oxygen * 10) / 10,
      score: this.score,
      coins: this.coins,
      combo: this.combo,
      depth: this.depth,
      maxDepth: this.maxDepth,
      zoneIndex: this.zoneIndex,
      gatesOpened: this.gatesOpened,
      nextGateDepth: rules.gateDepth(this.gatesOpened),
      frozen: Date.now() < this.frozenUntil,
    };
  }

  _reject(reason, detail) {
    this.flags += 1;
    this.emit('rejected', { reason, detail });
  }

  // --- Reports from the client ----------------------------------------------

  reportDepth(rawDepth) {
    if (this.ended) return;
    let depth = Number(rawDepth);
    if (!Number.isFinite(depth) || depth < 0) return this._reject('bad_depth');
    depth = Math.round(depth);

    // Check 1: could a diver physically have got here since the last report?
    const now = Date.now();
    const seconds = Math.max(0.05, (now - this.lastDepthAt) / 1000);
    const furthest = this.depth + LIMITS.maxMetersPerSec * seconds + 5;
    if (depth > furthest) {
      this._reject('too_fast', { depth, furthest: Math.round(furthest) });
      depth = Math.round(furthest);
    }

    // Check 2: nobody scores past a locked gate — even with the wall hacked
    // out of their copy of the game.
    // (A diver pressed against the gate can honestly read a metre or two
    // past it, so that's clamped quietly; anything further is flagged.)
    const gate = rules.gateDepth(this.gatesOpened);
    if (depth >= gate) {
      if (depth > gate + 2) this._reject('gate_locked', { depth, gate });
      depth = gate - 1;
    }

    this.depth = depth;
    this.lastDepthAt = now;

    if (depth > this.maxDepth) {
      const mult = ZONES[this.zoneIndex].scoreMult;
      this.score += (depth - this.maxDepth) * SCORE.perMeter * mult;
      this.maxDepth = depth;
      const zone = rules.zoneIndexAt(this.maxDepth);
      if (zone !== this.zoneIndex) {
        this.zoneIndex = zone;
        this.emit('zone:changed', { zoneIndex: zone, zone: ZONES[zone] });
      }
    }
  }

  // Shared checks for anything the client says it touched.
  _checkItem(id, expectedType) {
    const match = ITEM_ID.exec(String(id));
    if (!match || match[1] !== expectedType) return 'bad_id';
    if (this.collected.has(id)) return 'duplicate';
    // An item can only be near where the diver actually is.
    const chunk = Number(match[2]);
    const diverChunk = Math.floor(this.depth / LIMITS.chunkMeters);
    if (Math.abs(chunk - diverChunk) > 2) return 'too_far';
    return null;
  }

  collect(kind, id) {
    if (this.ended) return;
    const type = kind === 'coin' ? 'c' : kind === 'bubble' ? 'b' : null;
    if (!type) return this._reject('bad_kind', { kind });
    const problem = this._checkItem(id, type);
    if (problem) return this._reject(problem, { id });

    const now = Date.now();
    this.recentCollects = this.recentCollects.filter((t) => now - t < 1000);
    if (this.recentCollects.length >= LIMITS.maxCollectsPerSec) return this._reject('rate_limited', { id });
    this.recentCollects.push(now);
    this.collected.add(id);

    let points = 0;
    if (type === 'c') {
      this.combo = now - this.lastCoinAt <= SCORE.comboWindowMs ? Math.min(this.combo + 1, SCORE.maxCombo) : 1;
      this.lastCoinAt = now;
      points = SCORE.coin * this.combo * ZONES[this.zoneIndex].scoreMult;
      this.score += points;
      this.coins += 1;
    } else {
      this.oxygen = Math.min(OXYGEN.max, this.oxygen + OXYGEN.bubble);
    }
    this.emit('collected', { kind, id, points, combo: this.combo, oxygenGain: type === 'b' ? OXYGEN.bubble : 0 });
    this.emit('state', this.snapshot());
  }

  hit(kind) {
    if (this.ended) return;
    const damage = HAZARDS[kind];
    if (!damage) return this._reject('bad_kind', { kind });
    const now = Date.now();
    if (now - this.lastHitAt < LIMITS.hitCooldownMs) return; // still blinking, no double-hit
    this.lastHitAt = now;
    this.oxygen = Math.max(0, this.oxygen - damage);
    this.combo = 0;
    this.emit('hit', { kind, damage });
    this.emit('state', this.snapshot());
    if (this.oxygen <= 0) this._end('stung');
  }

  async reachGate(gateIndex) {
    if (this.ended || this.challenge || this.busy) return;
    if (Number(gateIndex) !== this.gatesOpened) return this._reject('wrong_gate', { gateIndex });
    const gate = rules.gateDepth(this.gatesOpened);
    if (this.depth < gate - 25) return this._reject('not_at_gate', { depth: this.depth, gate });
    await this._issueChallenge({ context: 'gate', gateIndex: this.gatesOpened });
  }

  async openChest(chestId) {
    if (this.ended || this.challenge || this.busy) return;
    const problem = this._checkItem(chestId, 'k');
    if (problem) return this._reject(problem, { chestId });
    this.collected.add(chestId); // a chest can only ever be tried once
    await this._issueChallenge({ context: 'chest', chestId });
  }

  async _issueChallenge(context) {
    this.busy = true;
    try {
      const puzzle = await challengeClient.getChallenge();
      if (this.ended) return;
      this.challenge = { challengeId: puzzle.challengeId, ...context };
      this.emit('challenge:issued', { ...context, imageUrl: puzzle.imageUrl, source: puzzle.source });
    } catch (err) {
      this.challenge = null;
      this.emit('error', { message: 'puzzle_unavailable', context: context.context });
    } finally {
      this.busy = false;
    }
  }

  async submitAnswer(answer) {
    if (this.ended || !this.challenge || this.busy) return;
    const challenge = this.challenge;
    this.busy = true;
    let result;
    try {
      result = await challengeClient.submitAnswer(challenge.challengeId, answer);
    } catch (err) {
      this.busy = false;
      this.challenge = null;
      this.emit('error', { message: 'answer_check_failed', context: challenge.context });
      return;
    }
    this.busy = false;
    if (this.ended) return;
    this.challenge = null;

    const reward = {};
    if (result.correct) {
      if (challenge.context === 'gate') {
        this.gatesOpened += 1;
        this.oxygen = Math.min(OXYGEN.max, this.oxygen + OXYGEN.gateReward);
        const unlockedZone = rules.zoneIndexAt(rules.gateDepth(challenge.gateIndex) + 1);
        reward.points = SCORE.gate * ZONES[unlockedZone].scoreMult;
        reward.oxygen = OXYGEN.gateReward;
        this.score += reward.points;
        this.emit('gate:opened', { gateIndex: challenge.gateIndex, depth: rules.gateDepth(challenge.gateIndex) });
      } else {
        this.chestsOpened += 1;
        this.coins += SCORE.chestTreasure;
        this.oxygen = Math.min(OXYGEN.max, this.oxygen + OXYGEN.chestReward);
        reward.points = SCORE.chest * ZONES[this.zoneIndex].scoreMult;
        reward.coins = SCORE.chestTreasure;
        reward.oxygen = OXYGEN.chestReward;
        this.score += reward.points;
      }
    } else {
      this.oxygen = Math.max(0, this.oxygen - OXYGEN.wrongAnswer);
      this.combo = 0;
      reward.oxygen = -OXYGEN.wrongAnswer;
    }

    this.emit('answer:result', {
      correct: result.correct,
      correctAnswer: result.correctAnswer,
      context: challenge.context,
      gateIndex: challenge.gateIndex,
      chestId: challenge.chestId,
      reward,
    });
    this.emit('state', this.snapshot());
    if (this.oxygen <= 0) return this._end('oxygen_empty');

    // A gate stays shut until it's solved: a wrong answer gets a NEW puzzle
    // straight away (a different photo, so you can't just guess again).
    if (!result.correct && challenge.context === 'gate') {
      await this._issueChallenge({ context: 'gate', gateIndex: challenge.gateIndex });
    }
  }

  async usePowerup(powerupId) {
    if (this.ended) return;
    // Check the rule BEFORE spending the item: a sonar ping with no puzzle
    // open would just waste it.
    if (powerupId === 'sonar_ping' && !this.challenge) {
      return this.emit('powerup:denied', { powerupId, error: 'no_puzzle_open' });
    }
    if (!['sonar_ping', 'air_tank', 'time_freeze'].includes(powerupId)) {
      return this.emit('powerup:denied', { powerupId, error: 'unknown_powerup' });
    }

    const { ok, error } = await identityClient.consumePowerup(this.authToken, powerupId);
    if (this.ended) return;
    if (!ok) return this.emit('powerup:denied', { powerupId, error });

    if (powerupId === 'air_tank') {
      this.oxygen = Math.min(OXYGEN.max, this.oxygen + OXYGEN.airTank);
      this.emit('powerup:applied', { powerupId, oxygen: OXYGEN.airTank });
    } else if (powerupId === 'time_freeze') {
      this.frozenUntil = Date.now() + POWERUP_EFFECTS.timeFreezeMs;
      this.emit('powerup:applied', { powerupId, forMs: POWERUP_EFFECTS.timeFreezeMs });
    } else {
      const peeked = this.challenge ? await challengeClient.peekChallenge(this.challenge.challengeId) : null;
      this.emit('powerup:applied', { powerupId, reveal: peeked ? peeked.fish : null, forMs: POWERUP_EFFECTS.sonarMs });
    }
    this.emit('state', this.snapshot());
  }

  quit() {
    this._end('surfaced');
  }

  _end(reason) {
    if (this.ended) return;
    this.ended = true;
    clearInterval(this._tick);
    this.emit('run:ended', {
      reason,
      score: this.score,
      maxDepth: this.maxDepth,
      coins: this.coins,
      chests: this.chestsOpened,
      gatesOpened: this.gatesOpened,
      zone: ZONES[this.zoneIndex].id,
      zoneName: ZONES[this.zoneIndex].name,
      site: this.conditions ? this.conditions.siteName : null,
      treasureEarned: this.coins,
      flags: this.flags,
      durationSeconds: Math.round((Date.now() - this.startedAt) / 1000),
    });
  }
}

module.exports = { DiveRun };
