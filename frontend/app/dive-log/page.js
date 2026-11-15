"use client";

import { useEffect, useState } from "react";
import RequireAuth from "../../components/RequireAuth";
import Sidebar from "../../components/Sidebar";
import { gameApi } from "../../lib/api";
import { useAuth } from "../AuthProvider";

function DiveLogContent() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    gameApi.diveLog(user.id).then(({ diveLog }) => setRows(diveLog));
  }, [user]);

  return (
    <div className="flex min-h-screen bg-abyss">
      <Sidebar />
      <main className="flex-1 p-10">
        <h1 className="font-display text-2xl font-semibold text-white mb-1">Dive Log</h1>
        <p className="text-textDim mb-6">Every dive you've logged, most recent first.</p>

        <div className="max-w-3xl rounded-xl border border-white/10 overflow-hidden">
          <div className="grid grid-cols-[1fr,8rem,5rem,5rem,4rem,4rem] px-4 py-2 text-xs text-textDim uppercase bg-white/5">
            <span>When</span>
            <span>Zone</span>
            <span className="text-cyan">Depth</span>
            <span className="text-coral">Score</span>
            <span className="text-gold">Coins</span>
            <span>Time</span>
          </div>
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr,8rem,5rem,5rem,4rem,4rem] px-4 py-3 text-sm border-t border-white/5">
              <span className="text-textDim">{new Date(row.created_at).toLocaleString()}</span>
              <span className="capitalize text-textDim">{row.zone}</span>
              <span className="font-mono text-cyan">{row.depth}m</span>
              <span className="font-mono text-coral">{row.score}</span>
              <span className="font-mono text-gold">{row.coins}</span>
              <span className="font-mono text-textDim">{row.duration_seconds}s</span>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="px-4 py-6 text-textDim text-sm">No dives logged yet.</div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function DiveLogPage() {
  return (
    <RequireAuth>
      <DiveLogContent />
    </RequireAuth>
  );
}
