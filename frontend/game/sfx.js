// game/sfx.js
//
// Sound effects with ZERO sound files and ZERO APIs: every sound is
// synthesised live by the browser's Web Audio API. A sound is just an
// oscillator (a tone generator) whose pitch and volume we sweep over a few
// hundredths of a second:
//   coin   = a quick rising "ding", higher with every combo step
//   sting  = a burst of noise + a low thud
//   gate   = three notes of a major chord, one after another
//
// Browsers refuse to make sound until the player has clicked something, so
// unlock() is called from the "Start dive" button.

let ctx = null;
let master = null;
let muted = false;

export function unlock() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.35;
  return muted;
}

function tone({ type = "sine", from, to = from, at = 0, dur = 0.15, vol = 0.5 }) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);  // fast attack...
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); // ...then fade out
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ at = 0, dur = 0.2, vol = 0.4, freq = 800 }) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + at;
  const length = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(master);
  src.start(t0);
}

export const sfx = {
  coin(combo = 1) {
    const base = 880 * Math.pow(1.122, combo - 1); // each combo step = one note higher
    tone({ type: "triangle", from: base, to: base * 1.5, dur: 0.09, vol: 0.35 });
  },
  bubble() {
    tone({ type: "sine", from: 260, to: 720, dur: 0.18, vol: 0.4 });
  },
  hit() {
    noise({ dur: 0.25, vol: 0.5, freq: 1200 });
    tone({ type: "sine", from: 140, to: 50, dur: 0.3, vol: 0.6 });
  },
  dash() {
    noise({ dur: 0.18, vol: 0.25, freq: 2400 });
  },
  chest() {
    tone({ type: "square", from: 520, to: 780, dur: 0.12, vol: 0.15 });
  },
  correct() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: "triangle", from: f, at: i * 0.07, dur: 0.22, vol: 0.3 }));
  },
  wrong() {
    tone({ type: "sawtooth", from: 300, to: 110, dur: 0.4, vol: 0.2 });
  },
  gate() {
    tone({ type: "sine", from: 110, to: 55, dur: 1.2, vol: 0.6 });
    [392, 494, 587].forEach((f, i) => tone({ type: "triangle", from: f, at: 0.1 + i * 0.12, dur: 0.5, vol: 0.25 }));
  },
  zone() {
    tone({ type: "sine", from: 70, to: 40, dur: 2.0, vol: 0.7 });
  },
  powerup() {
    tone({ type: "sine", from: 400, to: 1200, dur: 0.3, vol: 0.3 });
  },
  heartbeat() {
    tone({ type: "sine", from: 70, to: 45, dur: 0.12, vol: 0.6 });
    tone({ type: "sine", from: 65, to: 40, at: 0.18, dur: 0.12, vol: 0.5 });
  },
};
