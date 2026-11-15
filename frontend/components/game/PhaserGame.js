"use client";

// components/game/PhaserGame.js
//
// The ONE place React and Phaser actually touch. React owns a <div>; on
// mount we hand that div to Phaser, and from then on everything inside it is
// Phaser's. On unmount we destroy the engine — Phaser doesn't clean up after
// itself if you just stop rendering its container, and skipping this leaves
// a dead WebGL context behind on every page navigation.
//
// Phaser is imported INSIDE the effect, not at the top of the file: it
// touches `window` the moment it loads, and Next.js also runs this file on
// the server, where there is no window.

import { useEffect, useRef } from "react";

export default function PhaserGame({ bus, onReady }) {
  const containerRef = useRef(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let handle = null;
    let cancelled = false; // React (dev mode) mounts, unmounts and remounts once; don't build twice
    import("../../game/createGame").then(({ createGame }) => {
      if (cancelled) return;
      handle = createGame(containerRef.current, bus);
      onReadyRef.current?.(handle);
    });
    return () => {
      cancelled = true;
      handle?.destroy();
    };
  }, [bus]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
