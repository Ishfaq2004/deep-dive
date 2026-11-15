// game/bridge.js
//
// The MEDIATOR: the only code that knows both the game (the bus) and the
// server (the WebSocket). The entire client side of the protocol is these
// two tables — read them and you know every message the game sends and
// receives.

import { EVT } from "./bus";

// Game saw something -> tell the server.   [bus event, WS message type, payload]
const GAME_TO_SERVER = [
  [EVT.DEPTH,   "DEPTH",        ({ depth }) => ({ depth })],
  [EVT.COIN,    "COLLECT",      ({ id }) => ({ kind: "coin", id })],
  [EVT.BUBBLE,  "COLLECT",      ({ id }) => ({ kind: "bubble", id })],
  [EVT.HIT,     "HIT",          ({ kind }) => ({ kind })],
  [EVT.GATE,    "GATE_REACHED", ({ gateIndex }) => ({ gateIndex })],
  [EVT.CHEST,   "CHEST_OPENED", ({ chestId }) => ({ chestId })],
  [EVT.POWERUP, "USE_POWERUP",  ({ powerupId }) => ({ powerupId })],
];

// Server decided something -> show it in the game.
const SERVER_TO_GAME = [
  "STATE", "COLLECTED", "HIT", "ZONE_CHANGED", "GATE_OPENED",
  "ANSWER_RESULT", "POWERUP_APPLIED", "RUN_ENDED",
];

export function connectBridge(bus, socket) {
  const offs = [];
  for (const [event, type, toPayload] of GAME_TO_SERVER) {
    offs.push(bus.on(event, (payload) => socket.send(type, toPayload(payload))));
  }
  for (const type of SERVER_TO_GAME) {
    offs.push(socket.subscribe(type, (msg) => bus.emit(`net:${type}`, msg)));
  }
  return () => offs.forEach((off) => off()); // disconnect everything
}
