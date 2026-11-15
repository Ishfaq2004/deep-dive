"use client";

// components/game/PuzzleOverlay.js
//
// The Fish API moment. When the diver touches a lock or a chest, the
// server fetches a puzzle (challenge-service -> Fish API) and sends only the
// IMAGE. The answer never reaches the browser — you can't cheat by reading
// the network tab. This overlay shows the picture and takes your count.
//
// The game world freezes behind it, but your oxygen does NOT: the server's
// clock keeps ticking. Count fast.

import { useEffect, useRef, useState } from "react";
import { Kbd } from "./HUD";

export default function PuzzleOverlay({ puzzle, oxygen, sonar, sonarCount, onSubmit, onSonar }) {
  const [answer, setAnswer] = useState("");
  const inputRef = useRef(null);
  const result = puzzle.result;

  // New picture -> clear the box and focus it, so you can type immediately.
  useEffect(() => {
    setAnswer("");
    inputRef.current?.focus();
  }, [puzzle.imageUrl]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "r" || e.key === "R") { e.preventDefault(); onSonar(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSonar]);

  function submit(e) {
    e.preventDefault();
    if (answer === "" || result) return;
    onSubmit(Number(answer));
  }

  const isGate = puzzle.context === "gate";
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-abyss/70 backdrop-blur-sm">
      <div className="w-[560px] rounded-2xl border border-cyan/30 bg-mid/90 p-6 shadow-2xl">
        <div className="mb-1 font-mono text-xs uppercase tracking-widest text-cyan">
          {isGate ? "Pressure lock" : "Treasure chest"}
        </div>
        <h2 className="mb-4 font-display text-2xl font-semibold text-white">
          {isGate ? "Count the fish to open the lock" : "Count the fish to open the chest"}
        </h2>

        <div className="relative mb-4 overflow-hidden rounded-xl border border-white/10 bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={puzzle.imageUrl} alt="How many fish are in this picture?" className="mx-auto max-h-[300px] w-full object-contain" />
          {sonar != null && (
            <div className="absolute right-3 top-3 animate-pop rounded-lg bg-cyan px-3 py-1.5 font-mono text-lg font-bold text-abyss">
              Sonar: {sonar}
            </div>
          )}
        </div>

        <div className="mb-4 h-2 overflow-hidden rounded-full bg-abyss">
          <div className={`h-full transition-[width] duration-300 ${oxygen > 25 ? "bg-cyan" : "bg-coral"}`} style={{ width: `${oxygen}%` }} />
        </div>

        {result ? (
          <div className={`rounded-xl px-4 py-3 text-center font-semibold ${result.correct ? "bg-cyan text-abyss" : "bg-coral text-abyss"}`}>
            {result.correct
              ? `Correct! +${result.reward.points} pts${result.reward.coins ? ` · +${result.reward.coins} coins` : ""} · +${result.reward.oxygen} O₂`
              : `It was ${result.correctAnswer}. ${result.reward.oxygen} O₂${isGate ? " · new picture coming…" : ""}`}
          </div>
        ) : (
          <form onSubmit={submit} className="flex gap-3">
            <input
              ref={inputRef}
              type="number"
              min="0"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="How many fish?"
              className="flex-1 rounded-xl border border-white/15 bg-abyss px-4 py-3 font-mono text-lg text-white placeholder:text-textDim focus:border-cyan focus:outline-none"
            />
            <button type="submit" className="rounded-xl bg-cyan px-6 font-semibold text-abyss hover:bg-cyan/90">
              Enter
            </button>
          </form>
        )}

        <div className="mt-4 flex items-center justify-between text-xs text-textDim">
          <button
            onClick={onSonar}
            disabled={!sonarCount || sonar != null || !!result}
            className="flex items-center gap-2 rounded-lg border border-cyan/30 px-3 py-1.5 text-cyan disabled:opacity-35"
          >
            <Kbd>R</Kbd> Sonar Ping ×{sonarCount || 0}
          </button>
          <span>{puzzle.source === "fish-api" ? "Puzzle from the Fish API" : "Fallback puzzle (Fish API offline)"}</span>
        </div>
      </div>
    </div>
  );
}
