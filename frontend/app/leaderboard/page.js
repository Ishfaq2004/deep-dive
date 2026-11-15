"use client";

import { useEffect, useState } from "react";
import RequireAuth from "../../components/RequireAuth";
import Sidebar from "../../components/Sidebar";
import { gameApi } from "../../lib/api";
import { useAuth } from "../AuthProvider";

const MEDAL = ["🥇", "🥈", "🥉"];

function LeaderboardContent() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    gameApi.leaderboard().then(({ leaderboard }) => setRows(leaderboard));
  }, []);

  return (
    <div className="flex min-h-screen bg-abyss">
      <Sidebar />
      <main className="flex-1 p-10">
        <h1 className="font-display text-2xl font-semibold text-white mb-1">Leaderboard</h1>
        <p className="text-textDim mb-6">Best run on record for every diver.</p>

        <div className="max-w-2xl rounded-xl border border-white/10 overflow-hidden">
          <div className="grid grid-cols-[2rem,1fr,6rem,6rem] px-4 py-2 text-xs text-textDim uppercase bg-white/5">
            <span></span>
            <span>Diver</span>
            <span className="text-cyan">Depth</span>
            <span className="text-coral">Score</span>
          </div>
          {rows.map((row, i) => (
            <div
              key={row.username}
              className={`grid grid-cols-[2rem,1fr,6rem,6rem] px-4 py-3 text-sm border-t border-white/5 ${
                row.username === user?.username ? "bg-cyan/10" : ""
              }`}
            >
              <span>{MEDAL[i] || i + 1}</span>
              <span className="text-white">{row.username}</span>
              <span className="font-mono text-cyan">{row.best_depth}m</span>
              <span className="font-mono text-coral">{row.best_score}</span>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="px-4 py-6 text-textDim text-sm">No dives yet — be the first.</div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <RequireAuth>
      <LeaderboardContent />
    </RequireAuth>
  );
}
