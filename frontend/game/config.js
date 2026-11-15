// game/config.js
//
// Game feel is just numbers. Every number that decides how the game FEELS
// (not who wins — that's the server's shared/gameRules.js) lives here, so
// tuning is one file, not a hunt through ten.
//
// Try it: double DIVER.drag and the water turns to syrup. Halve DIVER.accel
// and the diver feels heavy. That's "game feel" — and it's why this file
// exists.

export const GAME_W = 1280;           // the logical screen; Phaser scales it to fit any window
export const GAME_H = 720;
export const PX_PER_METER = 10;       // 10 pixels of world = 1 metre of depth
export const SURFACE_Y = 0;           // world y of the sea surface
export const PLAY_LEFT = 70;          // the diver can't swim into the rock walls
export const PLAY_RIGHT = GAME_W - 70;

export const DIVER = {
  accel: 1500,          // px/s² while a key is held
  maxSpeed: 330,        // px/s cruising top speed (≈ 33 m/s)
  drag: 0.1,            // fraction of speed KEPT after 1 s with no input (water resistance)
  sink: 45,             // px/s² of gentle sinking — the ocean pulls you down
  dashSpeed: 640,       // px/s burst
  dashMs: 200,
  dashCooldownMs: 1100,
  invulnMs: 900,        // blink time after a sting (matches the server's hit cooldown)
  knockback: 420,
};

export const CURRENT_ACCEL = 150;     // px/s² of sideways push at the strongest real current
export const MAGNET = { radius: 95, pull: 1100 }; // coins drift into you when close
export const CHUNK_PX = 600;          // 60 m slices — must match the server's chunkMeters
export const DEPTH_REPORT_MS = 200;   // how often the client tells the server its depth
export const CAMERA_LOOKAHEAD = 140;  // camera sits below the diver so you see what's coming

// Visibility (from the REAL sea state at the dive site) -> headlamp radius.
export const HEADLAMP = { clear: 300, murky: 230, stormy: 190 };
