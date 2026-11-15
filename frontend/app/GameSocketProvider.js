"use client";

// app/GameSocketProvider.js
//
// One WebSocket connection to game-service, shared by whatever's on
// screen — the HUD, the Phaser scene, the game-over modal. Each of those
// calls subscribe(type, handler) to register interest in exactly the
// message types it cares about, same Observer Pattern as the backend's
// EventEmitter (run.on / run.emit), just implemented by hand here instead
// of imported, so the parallel is visible in the code rather than hidden
// behind a library. Nothing in this file knows who's listening or how
// many listeners there are — the Hollywood Principle, client-side.

import { createContext, useContext, useRef, useState, useCallback } from "react";

const GameSocketContext = createContext(null);

const WS_URL = process.env.NEXT_PUBLIC_GAME_WS_URL || "ws://localhost:4712";

export function GameSocketProvider({ children }) {
  const wsRef = useRef(null);
  const listenersRef = useRef(new Map()); // type -> Set<handler>
  const [status, setStatus] = useState("idle"); // idle | connecting | open | closed

  const dispatch = useCallback((type, payload) => {
    const handlers = listenersRef.current.get(type);
    if (!handlers) return;
    for (const handler of handlers) handler(payload);
  }, []);

  const connect = useCallback(
    (token) =>
      new Promise((resolve, reject) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          resolve();
          return;
        }
        setStatus("connecting");
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: "AUTH", token }));
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === "AUTH_OK") {
            setStatus("open");
            resolve(msg);
          }
          dispatch(msg.type, msg);
        };

        ws.onclose = () => setStatus("closed");
        ws.onerror = (err) => {
          setStatus("closed");
          reject(err);
        };
      }),
    [dispatch]
  );

  const send = useCallback((type, payload = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...payload }));
    }
  }, []);

  // Returns an unsubscribe function, same shape as addEventListener.
  const subscribe = useCallback((type, handler) => {
    if (!listenersRef.current.has(type)) listenersRef.current.set(type, new Set());
    listenersRef.current.get(type).add(handler);
    return () => listenersRef.current.get(type)?.delete(handler);
  }, []);

  return (
    <GameSocketContext.Provider value={{ status, connect, send, subscribe }}>
      {children}
    </GameSocketContext.Provider>
  );
}

export function useGameSocket() {
  const ctx = useContext(GameSocketContext);
  if (!ctx) throw new Error("useGameSocket must be used inside <GameSocketProvider>");
  return ctx;
}
