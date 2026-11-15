"use client";

// components/game/Briefing.js — the pre-dive screen: what to do, which keys.

import Link from "next/link";
import { Kbd } from "./HUD";

const ROWS = [
  [["W", "A", "S", "D"], "or arrow keys — swim"],
  [["Space"], "dash (short burst, 1 s cooldown)"],
  [["Q"], "Air Tank · +25% oxygen"],
  [["E"], "Time Freeze · oxygen and creatures stop for 5 s"],
  [["R"], "Sonar Ping · during a puzzle, reveals the count"],
  [["F"], "fullscreen     ·     M  mute     ·     G  show hitboxes"],
];

export default function Briefing({ ready, busy, owned, onStart }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-abyss/40">
      <div className="w-[600px] rounded-2xl border border-white/10 bg-abyss/85 p-8 shadow-2xl backdrop-blur">
        <div className="font-mono text-xs uppercase tracking-widest text-cyan">Dive briefing</div>
        <h1 className="mb-3 mt-1 font-display text-4xl font-bold text-white">
          How deep can you go?
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-textDim">
          Your air runs out on its own. <span className="text-cyan">Bubbles</span> give it back,{" "}
          <span className="text-gold">coins</span> build your score (grab them in a row for a combo),
          and jellyfish, pufferfish and anglerfish sting. Pressure locks block the way down —
          <span className="text-white"> count the fish</span> to open them. The sea state comes live from a real reef.
        </p>

        <div className="mb-6 space-y-2">
          {ROWS.map(([keys, text]) => (
            <div key={text} className="flex items-center gap-3 text-sm text-white">
              <div className="flex w-36 gap-1">{keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</div>
              <span className="text-textDim">{text}</span>
            </div>
          ))}
        </div>

        <div className="mb-6 text-xs text-textDim">
          In your kit: {owned.air_tank || 0} air tank · {owned.time_freeze || 0} time freeze · {owned.sonar_ping || 0} sonar ping ·{" "}
          <Link href="/shop" className="text-gold underline">Dive Shop</Link>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onStart}
            disabled={!ready || busy}
            className="rounded-xl bg-cyan px-8 py-3 text-lg font-semibold text-abyss hover:bg-cyan/90 disabled:opacity-50"
          >
            {!ready ? "Loading the ocean…" : busy ? "Checking the sea…" : "Start dive"}
          </button>
          <Link href="/dashboard" className="text-sm text-textDim hover:text-white">Back to dashboard</Link>
        </div>
      </div>
    </div>
  );
}
