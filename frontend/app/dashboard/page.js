"use client";

import RequireAuth from "../../components/RequireAuth";
import Sidebar from "../../components/Sidebar";
import StatCard from "../../components/StatCard";
import { useAuth } from "../AuthProvider";
import { useEffect, useState } from "react";
import { gameApi } from "../../lib/api";
import Link from "next/link";

function DashboardContent() {
  const { user } = useAuth();
  const [best, setBest] = useState(null);

  useEffect(() => {
    if (!user) return;
    gameApi
      .diveLog(user.id)
      .then(({ diveLog }) => {
        if (diveLog.length === 0) return;
        const bestScore = Math.max(...diveLog.map((d) => d.score));
        const bestDepth = Math.max(...diveLog.map((d) => d.depth));
        setBest({ bestScore, bestDepth });
      })
      .catch(() => {});
  }, [user]);

  return (
    <div className="flex min-h-screen bg-abyss">
      <Sidebar />
      <main className="flex-1 p-10">
        <h1 className="font-display text-2xl font-semibold text-white mb-1">
          Welcome back, {user.username}
        </h1>
        <p className="text-textDim mb-8">Ready for another dive?</p>

        <div className="grid grid-cols-3 gap-4 max-w-2xl mb-10">
          <StatCard label="Best depth" value={best ? `${best.bestDepth}m` : "—"} accent="cyan" />
          <StatCard label="Best score" value={best ? best.bestScore : "—"} accent="coral" />
          <StatCard label="Treasure" value={user.treasure} accent="gold" />
        </div>

        <Link
          href="/play"
          className="inline-block px-6 py-3 rounded-lg bg-cyan text-abyss font-semibold hover:bg-cyan/90"
        >
          Start a dive →
        </Link>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
