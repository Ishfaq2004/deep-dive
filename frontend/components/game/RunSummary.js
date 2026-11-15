"use client";

// components/game/RunSummary.js — the results screen, straight from RUN_ENDED.

import Link from "next/link";

const REASON = {
  oxygen_empty: "Out of air",
  stung: "Stung on your last breath",
  surfaced: "You surfaced",
};

function Stat({ label, value, cls }) {
  return (
    <div className="rounded-xl border border-white/10 bg-abyss/60 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-textDim">{label}</div>
      <div className={`font-mono text-2xl font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

export default function RunSummary({ summary, onDiveAgain }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-abyss/80 backdrop-blur">
      <div className="w-[560px] rounded-2xl border border-white/10 bg-mid/90 p-8 text-center shadow-2xl">
        <div className="font-mono text-xs uppercase tracking-widest text-cyan">Dive complete</div>
        <h2 className="mb-1 mt-1 font-display text-3xl font-semibold text-white">{REASON[summary.reason] || "Run over"}</h2>
        <p className="mb-6 text-sm text-textDim">
          Reached the {summary.zoneName}{summary.site ? ` · ${summary.site}` : ""} · {summary.durationSeconds}s
        </p>

        <div className="mb-6 grid grid-cols-3 gap-3">
          <Stat label="Max depth" value={`${summary.maxDepth} m`} cls="text-cyan" />
          <Stat label="Score" value={summary.score} cls="text-coral" />
          <Stat label="Coins" value={`+${summary.treasureEarned}`} cls="text-gold" />
          <Stat label="Locks opened" value={summary.gatesOpened} cls="text-white" />
          <Stat label="Chests" value={summary.chests} cls="text-white" />
          <Stat label="Treasure" value={summary.treasure ?? "—"} cls="text-gold" />
        </div>

        <div className="flex justify-center gap-3">
          <button onClick={onDiveAgain} className="rounded-xl bg-cyan px-6 py-3 font-semibold text-abyss hover:bg-cyan/90">
            Dive again
          </button>
          <Link href="/shop" className="rounded-xl border border-gold/40 px-5 py-3 text-gold hover:bg-gold/10">
            Spend treasure
          </Link>
          <Link href="/dashboard" className="rounded-xl border border-white/15 px-5 py-3 text-white hover:bg-white/5">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
