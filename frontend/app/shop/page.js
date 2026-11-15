"use client";

import { useEffect, useState } from "react";
import RequireAuth from "../../components/RequireAuth";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../AuthProvider";
import { identityApi } from "../../lib/api";

const ACCENT_BY_ID = {
  sonar_ping: "cyan",
  air_tank: "gold",
  time_freeze: "coral",
};
const BORDER = { cyan: "border-cyan/30", gold: "border-gold/30", coral: "border-coral/30" };
const TEXT = { cyan: "text-cyan", gold: "text-gold", coral: "text-coral" };

function ShopContent() {
  const { user, token, refreshMe } = useAuth();
  const [powerups, setPowerups] = useState([]);
  const [owned, setOwned] = useState({});
  const [message, setMessage] = useState(null);

  useEffect(() => {
    identityApi.powerups().then(({ powerups }) => setPowerups(powerups));
    identityApi.me(token).then(({ owned }) => {
      const map = {};
      owned.forEach((o) => (map[o.powerup_id] = o.quantity));
      setOwned(map);
    });
  }, [token]);

  async function buy(powerupId) {
    setMessage(null);
    try {
      const { user: updatedUser, owned: updatedOwned } = await identityApi.purchase(token, powerupId);
      const map = {};
      updatedOwned.forEach((o) => (map[o.powerup_id] = o.quantity));
      setOwned(map);
      await refreshMe();
      setMessage({ type: "ok", text: `Bought! ${updatedUser.treasure} treasure left.` });
    } catch (err) {
      setMessage({
        type: "error",
        text: err.status === 402 ? "Not enough treasure." : "Couldn't complete the purchase.",
      });
    }
  }

  return (
    <div className="flex min-h-screen bg-abyss">
      <Sidebar />
      <main className="flex-1 p-10">
        <h1 className="font-display text-2xl font-semibold text-white mb-1">Dive Shop</h1>
        <p className="text-textDim mb-6">Spend treasure earned from past dives on power-ups.</p>
        {message && (
          <p className={`mb-4 text-sm ${message.type === "ok" ? "text-cyan" : "text-coral"}`}>{message.text}</p>
        )}

        <div className="grid grid-cols-3 gap-5 max-w-3xl">
          {powerups.map((p) => {
            const accent = ACCENT_BY_ID[p.id] || "cyan";
            const canAfford = user.treasure >= p.price;
            return (
              <div key={p.id} className={`rounded-xl border bg-mid/60 p-5 ${BORDER[accent]}`}>
                <div className={`text-sm font-semibold mb-1 ${TEXT[accent]}`}>{p.name}</div>
                <p className="text-textDim text-sm mb-4">{p.description}</p>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-gold">{p.price}</span>
                  <button
                    onClick={() => buy(p.id)}
                    disabled={!canAfford}
                    className="text-xs px-3 py-1.5 rounded-md bg-white/10 text-white hover:bg-white/20 disabled:opacity-40"
                  >
                    Buy
                  </button>
                </div>
                {owned[p.id] > 0 && (
                  <div className="mt-2 text-xs text-textDim">Owned: {owned[p.id]}</div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default function ShopPage() {
  return (
    <RequireAuth>
      <ShopContent />
    </RequireAuth>
  );
}
