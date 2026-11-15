// game/textures.js
//
// ALL the game's art, drawn in code. No PNGs, no downloads, no licences.
//
// A "texture" is just an image stored on the graphics card. Normally you
// load PNG files into textures. Here we make each texture by drawing on an
// HTML canvas with the ordinary Canvas 2D API (the same ctx.arc / ctx.fill
// you'd use on any web page), then hand that canvas to Phaser as a texture.
// After that, Phaser can stamp it on screen thousands of times a second.
//
// The art style plays to that strength: glowing, bioluminescent shapes on
// dark water. Soft glow is one line of canvas code (ctx.shadowBlur), and
// glow is exactly what deep-sea creatures look like.

function make(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  draw(ctx, w, h, tex);
  tex.refresh();
  return tex;
}

function glow(ctx, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function noGlow(ctx) {
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}

// --- The diver: a 4-frame flipbook of fins kicking ------------------------

const DIVER_FRAME_W = 120;
const DIVER_FRAME_H = 60;

function drawDiver(ctx, ox, kick) {
  ctx.save();
  ctx.translate(ox, 0);
  const cy = 32;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Legs + fins (the only part that changes between frames).
  const upper = cy - 4 + kick * 7;
  const lower = cy + 6 - kick * 7;
  ctx.strokeStyle = "#0f2740";
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(40, cy - 1); ctx.lineTo(20, upper); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(40, cy + 3); ctx.lineTo(20, lower); ctx.stroke();
  glow(ctx, "rgba(57,230,201,0.8)", 8);
  ctx.fillStyle = "#39e6c9";
  for (const y of [upper, lower]) {
    ctx.beginPath();
    ctx.moveTo(22, y - 3);
    ctx.lineTo(2, y - 9 + kick * 2);
    ctx.lineTo(4, y + 8 - kick * 2);
    ctx.lineTo(22, y + 3);
    ctx.closePath();
    ctx.fill();
  }
  noGlow(ctx);

  // Air tank on the back.
  const tank = ctx.createLinearGradient(0, cy - 16, 0, cy - 6);
  tank.addColorStop(0, "#ffe08a");
  tank.addColorStop(1, "#c98a1e");
  ctx.fillStyle = tank;
  ctx.beginPath(); ctx.roundRect(38, cy - 17, 40, 11, 5); ctx.fill();
  ctx.fillStyle = "#8a5a10";
  ctx.fillRect(48, cy - 17, 3, 11);

  // Torso (wetsuit) with a cyan rim light so it pops on dark water.
  glow(ctx, "rgba(57,230,201,0.55)", 10);
  const suit = ctx.createLinearGradient(0, cy - 10, 0, cy + 10);
  suit.addColorStop(0, "#1d4a72");
  suit.addColorStop(1, "#0d2238");
  ctx.fillStyle = suit;
  ctx.beginPath(); ctx.ellipse(60, cy, 25, 10, 0, 0, Math.PI * 2); ctx.fill();
  noGlow(ctx);
  ctx.strokeStyle = "#39e6c9";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(40, cy + 2); ctx.lineTo(80, cy + 1); ctx.stroke();

  // Arm reaching forward.
  ctx.strokeStyle = "#163a5c";
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(74, cy + 3); ctx.lineTo(98, cy + 7); ctx.stroke();

  // Head, mask, headlamp.
  ctx.fillStyle = "#152b45";
  ctx.beginPath(); ctx.arc(92, cy - 3, 10, 0, Math.PI * 2); ctx.fill();
  const mask = ctx.createLinearGradient(92, cy - 9, 104, cy + 1);
  mask.addColorStop(0, "#c9f6ff");
  mask.addColorStop(1, "#3fa9d6");
  ctx.fillStyle = mask;
  ctx.beginPath(); ctx.roundRect(94, cy - 9, 11, 9, 3); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(96, cy - 8, 3, 2);
  glow(ctx, "rgba(255,247,194,1)", 12);
  ctx.fillStyle = "#fff7c2";
  ctx.beginPath(); ctx.arc(100, cy - 12, 3, 0, Math.PI * 2); ctx.fill();
  noGlow(ctx);
  ctx.restore();
}

// --- Rock walls that tile seamlessly forever downward ----------------------
// The wall edge is a sum of sine waves whose periods all divide the texture
// height, so the bottom edge lines up exactly with the top: it tiles.

function wallProfile(y, h, seeds, base, amp) {
  let x = base;
  seeds.forEach(([k, phase, a]) => { x += amp * a * Math.sin((2 * Math.PI * k * y) / h + phase); });
  return x;
}

function drawWalls(ctx, w, h, { base, amp, shade, rim, seedsL, seedsR }) {
  for (const side of ["L", "R"]) {
    const seeds = side === "L" ? seedsL : seedsR;
    const edgeX = (y) => (side === "L" ? wallProfile(y, h, seeds, base, amp) : w - wallProfile(y, h, seeds, base, amp));
    const outer = side === "L" ? 0 : w;

    // Fill the rock...
    ctx.beginPath();
    ctx.moveTo(outer, 0);
    for (let y = 0; y <= h; y += 4) ctx.lineTo(edgeX(y), y);
    ctx.lineTo(outer, h);
    ctx.closePath();
    ctx.fillStyle = shade;
    ctx.fill();

    // ...then outline ONLY the cliff edge. Outlining the whole closed shape
    // would also draw its top and bottom borders, which show up as a
    // horizontal seam every time the texture repeats.
    ctx.beginPath();
    for (let y = 0; y <= h; y += 4) (y === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, edgeX(y), y);
    ctx.strokeStyle = rim;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

export function makeTextures(scene) {
  // Diver flipbook: 4 frames side by side on one canvas.
  make(scene, "diver", DIVER_FRAME_W * 4, DIVER_FRAME_H, (ctx, w, h, tex) => {
    [1, 0.35, -1, -0.35].forEach((kick, i) => {
      drawDiver(ctx, i * DIVER_FRAME_W, kick);
      tex.add(i, 0, i * DIVER_FRAME_W, 0, DIVER_FRAME_W, DIVER_FRAME_H);
    });
  });

  make(scene, "coin", 40, 40, (ctx) => {
    glow(ctx, "rgba(242,184,75,0.9)", 10);
    const g = ctx.createRadialGradient(16, 15, 2, 20, 20, 14);
    g.addColorStop(0, "#fff6c4");
    g.addColorStop(0.5, "#f2b84b");
    g.addColorStop(1, "#a86a0f");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(20, 20, 13, 0, Math.PI * 2); ctx.fill();
    noGlow(ctx);
    ctx.strokeStyle = "rgba(255,240,190,0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(20, 20, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath(); ctx.ellipse(15, 14, 3, 1.6, -0.6, 0, Math.PI * 2); ctx.fill();
  });

  make(scene, "bubble", 48, 48, (ctx) => {
    glow(ctx, "rgba(150,235,255,0.9)", 12);
    ctx.fillStyle = "rgba(170,235,255,0.18)";
    ctx.beginPath(); ctx.arc(24, 24, 17, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(215,248,255,0.95)";
    ctx.lineWidth = 2;
    ctx.stroke();
    noGlow(ctx);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(24, 24, 12, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
    ctx.fillStyle = "rgba(220,250,255,0.95)";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("O2", 24, 28);
  });

  make(scene, "chest", 72, 60, (ctx) => {
    glow(ctx, "rgba(242,184,75,0.8)", 16);
    const wood = ctx.createLinearGradient(0, 18, 0, 54);
    wood.addColorStop(0, "#8a5426");
    wood.addColorStop(1, "#3e2410");
    ctx.fillStyle = wood;
    ctx.beginPath(); ctx.roundRect(10, 26, 52, 28, 4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(10, 28); ctx.quadraticCurveTo(36, 4, 62, 28); ctx.closePath(); ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = "#f2b84b";
    ctx.fillRect(10, 26, 52, 4);
    ctx.fillRect(20, 14, 4, 40);
    ctx.fillRect(48, 14, 4, 40);
    ctx.beginPath(); ctx.roundRect(31, 30, 10, 12, 2); ctx.fill();
    ctx.fillStyle = "#3e2410";
    ctx.fillRect(35, 35, 2, 4);
  });

  make(scene, "jelly", 72, 96, (ctx) => {
    glow(ctx, "rgba(255,110,200,0.9)", 18);
    const bell = ctx.createRadialGradient(36, 22, 4, 36, 30, 28);
    bell.addColorStop(0, "rgba(255,190,235,0.95)");
    bell.addColorStop(1, "rgba(200,70,210,0.55)");
    ctx.fillStyle = bell;
    ctx.beginPath(); ctx.ellipse(36, 32, 26, 22, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
    noGlow(ctx);
    ctx.strokeStyle = "rgba(255,160,230,0.75)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const x = 16 + i * 8;
      ctx.beginPath();
      ctx.moveTo(x, 33);
      ctx.bezierCurveTo(x - 6, 50, x + 6, 66, x - 2, 92);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath(); ctx.ellipse(28, 20, 6, 3, -0.4, 0, Math.PI * 2); ctx.fill();
  });

  make(scene, "puffer", 80, 72, (ctx) => {
    ctx.strokeStyle = "#ffd27a";
    ctx.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(40 + Math.cos(a) * 20, 36 + Math.sin(a) * 20);
      ctx.lineTo(40 + Math.cos(a) * 31, 36 + Math.sin(a) * 31);
      ctx.stroke();
    }
    glow(ctx, "rgba(255,170,60,0.8)", 12);
    const body = ctx.createRadialGradient(34, 28, 4, 40, 36, 24);
    body.addColorStop(0, "#ffe9a3");
    body.addColorStop(1, "#e88a1a");
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(40, 36, 22, 0, Math.PI * 2); ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(50, 30, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0a1628";
    ctx.beginPath(); ctx.arc(52, 30, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#7a3d05";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(58, 42, 4, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke();
  });

  make(scene, "angler", 128, 88, (ctx) => {
    // Lure first, so it sits "behind" the head.
    ctx.strokeStyle = "#3a2a55";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(86, 30); ctx.quadraticCurveTo(100, 2, 116, 12); ctx.stroke();
    glow(ctx, "rgba(120,255,220,1)", 22);
    ctx.fillStyle = "#b8fff0";
    ctx.beginPath(); ctx.arc(116, 14, 6, 0, Math.PI * 2); ctx.fill();
    noGlow(ctx);
    const body = ctx.createRadialGradient(60, 44, 6, 60, 50, 46);
    body.addColorStop(0, "#3b2a5c");
    body.addColorStop(1, "#140b22");
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(58, 50, 44, 28, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(16, 50); ctx.lineTo(0, 30); ctx.lineTo(4, 70); ctx.closePath(); ctx.fill();
    // Mouth + teeth.
    ctx.fillStyle = "#05020a";
    ctx.beginPath(); ctx.moveTo(100, 44); ctx.quadraticCurveTo(70, 56, 102, 66); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f4f0ff";
    for (let i = 0; i < 5; i++) {
      const x = 82 + i * 4;
      ctx.beginPath(); ctx.moveTo(x, 50 + i * 0.8); ctx.lineTo(x + 2, 57); ctx.lineTo(x + 4, 50 + i * 0.8); ctx.fill();
    }
    glow(ctx, "rgba(255,80,160,1)", 10);
    ctx.fillStyle = "#ff6fb5";
    ctx.beginPath(); ctx.arc(80, 38, 3.5, 0, Math.PI * 2); ctx.fill();
    noGlow(ctx);
  });

  make(scene, "urchin", 72, 72, (ctx) => {
    glow(ctx, "rgba(190,90,255,0.9)", 10);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const len = 26 + (i % 3) * 4;
      const grad = ctx.createLinearGradient(36, 36, 36 + Math.cos(a) * len, 36 + Math.sin(a) * len);
      grad.addColorStop(0, "#5a2a8a");
      grad.addColorStop(1, "#ff8ad8");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(36, 36); ctx.lineTo(36 + Math.cos(a) * len, 36 + Math.sin(a) * len); ctx.stroke();
    }
    ctx.fillStyle = "#3a1460";
    ctx.beginPath(); ctx.arc(36, 36, 13, 0, Math.PI * 2); ctx.fill();
    noGlow(ctx);
  });

  // Small ambient fish, drawn white so each school can be tinted any colour.
  make(scene, "fish", 40, 20, (ctx) => {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.ellipse(22, 10, 13, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(1, 3); ctx.lineTo(1, 17); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#0a1628";
    ctx.beginPath(); ctx.arc(29, 8, 1.6, 0, Math.PI * 2); ctx.fill();
  });

  make(scene, "spark", 16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
  });

  // A shaft of sunlight: bright at the top, fading out, soft at the sides.
  make(scene, "ray", 160, 720, (ctx, w, h) => {
    const down = ctx.createLinearGradient(0, 0, 0, h);
    down.addColorStop(0, "rgba(255,255,255,0.55)");
    down.addColorStop(0.7, "rgba(255,255,255,0.08)");
    down.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = down;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "destination-in";
    const across = ctx.createLinearGradient(0, 0, w, 0);
    across.addColorStop(0, "rgba(0,0,0,0)");
    across.addColorStop(0.5, "rgba(0,0,0,1)");
    across.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = across;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
  });

  // The "brush" we cut light out of the darkness with: solid in the middle,
  // fading to nothing at the edge.
  make(scene, "light", 256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.45, "rgba(255,255,255,0.85)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });

  // Gate band: a glowing energy barrier that tiles sideways.
  make(scene, "gateTile", 96, 56, (ctx, w, h) => {
    ctx.fillStyle = "rgba(57,230,201,0.14)";
    ctx.fillRect(0, 8, w, h - 16);
    glow(ctx, "rgba(57,230,201,1)", 10);
    ctx.strokeStyle = "rgba(120,255,230,0.95)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 9); ctx.lineTo(w, 9); ctx.moveTo(0, h - 9); ctx.lineTo(w, h - 9); ctx.stroke();
    noGlow(ctx);
    ctx.strokeStyle = "rgba(57,230,201,0.45)";
    ctx.lineWidth = 1.5;
    for (let x = 0; x < w; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 28); ctx.lineTo(x + 6, 18); ctx.lineTo(x + 18, 18); ctx.lineTo(x + 24, 28);
      ctx.lineTo(x + 18, 38); ctx.lineTo(x + 6, 38); ctx.closePath(); ctx.stroke();
    }
  });

  make(scene, "gateCore", 200, 200, (ctx) => {
    glow(ctx, "rgba(57,230,201,1)", 16);
    ctx.strokeStyle = "rgba(140,255,235,0.95)";
    [70, 52, 34].forEach((r, i) => {
      ctx.lineWidth = 4 - i;
      ctx.setLineDash(i === 1 ? [10, 8] : []);
      ctx.beginPath(); ctx.arc(100, 100, r, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(10,22,40,0.85)";
    ctx.beginPath(); ctx.arc(100, 100, 30, 0, Math.PI * 2); ctx.fill();
    noGlow(ctx);
    // A little fish icon: "count the fish to pass".
    ctx.fillStyle = "#39e6c9";
    ctx.beginPath(); ctx.ellipse(104, 100, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(92, 100); ctx.lineTo(80, 91); ctx.lineTo(80, 109); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#0a1628";
    ctx.beginPath(); ctx.arc(110, 97, 2, 0, Math.PI * 2); ctx.fill();
  });

  // Two layers of rock walls, drawn in light grey so each zone can tint
  // them its own colour.
  make(scene, "wallsFar", 1280, 1024, (ctx, w, h) => {
    drawWalls(ctx, w, h, {
      base: 150, amp: 40, shade: "#b9c6d4", rim: "rgba(255,255,255,0.35)",
      seedsL: [[1, 0.3, 1], [3, 1.7, 0.6], [7, 0.2, 0.3]],
      seedsR: [[2, 2.1, 1], [5, 0.9, 0.5], [9, 1.3, 0.25]],
    });
  });
  make(scene, "wallsNear", 1280, 1024, (ctx, w, h) => {
    drawWalls(ctx, w, h, {
      base: 74, amp: 26, shade: "#6b7888", rim: "rgba(255,255,255,0.5)",
      seedsL: [[2, 1.1, 1], [4, 0.4, 0.7], [11, 2.2, 0.3]],
      seedsR: [[1, 0.7, 1], [6, 2.5, 0.6], [13, 0.1, 0.3]],
    });
  });

  // The sea surface, seen from below: a bright, wavy band.
  make(scene, "surface", 1280, 80, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(220,250,255,0.95)");
    g.addColorStop(1, "rgba(120,220,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, 22 + Math.sin(x / 40) * 6 + Math.sin(x / 13) * 2);
    ctx.lineTo(w, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(0, 0, w, 16);
  });

  make(scene, "white", 4, 4, (ctx) => { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 4, 4); });
}

export const DIVER_SIZE = { w: DIVER_FRAME_W, h: DIVER_FRAME_H };
