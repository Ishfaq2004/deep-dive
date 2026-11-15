export function createBus() {
  const listeners = new Map(); 

  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
      return () => listeners.get(event)?.delete(handler); // call to unsubscribe
    },
    emit(event, payload) {
      const handlers = listeners.get(event);
      if (!handlers) return;
      for (const handler of [...handlers]) handler(payload);
    },
    clear() {
      listeners.clear();
    },
  };
}

// Every event name in one place, so a typo is a crash, not a silent bug.
export const EVT = {
  // game -> page ("the game saw something")
  READY: "game:ready",
  DEPTH: "diver:depth",
  COIN: "pickup:coin",
  BUBBLE: "pickup:bubble",
  HIT: "diver:hit",
  GATE: "gate:touched",
  CHEST: "chest:touched",
  POWERUP: "powerup:request",
  SURFACE: "diver:surface",

  // page -> game ("the server said something")
  NET_STATE: "net:STATE",
  NET_COLLECTED: "net:COLLECTED",
  NET_HIT: "net:HIT",
  NET_ZONE: "net:ZONE_CHANGED",
  NET_GATE_OPENED: "net:GATE_OPENED",
  NET_ANSWER: "net:ANSWER_RESULT",
  NET_POWERUP: "net:POWERUP_APPLIED",
  NET_ENDED: "net:RUN_ENDED",
  PUZZLE_OPEN: "puzzle:open",
  PUZZLE_CLOSE: "puzzle:close",
};
