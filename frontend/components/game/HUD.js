"use client";

// components/game/HUD.js
//
// The HUD (heads-up display): everything that lives "on the glass" rather
// than in the water. Rule of thumb for this project:
//   if it lives IN THE WORLD (a coin, a "+30" over the diver) -> Phaser draws it
//   if it lives ON THE SCREEN (oxygen bar, score, buttons)     -> React draws it
// React is great at text, layout and buttons; Phaser is great at 60 fps
// motion. Each does what it's good at.
//
// Every number here comes from the server's STATE message — except depth,
// which the game reports locally 5x a second so it scrolls smoothly.

const VIS = {
  clear: { label: "Clear", cls: "text-cyan border-cyan/40" },
  murky: { label: "Murky", cls: "text-gold border-gold/40" },
  stormy: { label: "Stormy", cls: "text-coral border-coral/40" },
};

export function Kbd({ children }) {
  return (
    <kbd className="inline-flex min-w-[1.6rem] h-6 items-center justify-center rounded-md border border-white/25 bg-white/10 px-1.5 font-mono text-[11px] text-white">
      {children}
    </kbd>
  );
}

function PowerSlot({ hotkey, label, count, onUse, accent, disabled }) {
  const ACC = { cyan: "border-cyan/40 text-cyan", gold: "border-gold/40 text-gold", coral: "border-coral/40 text-coral" };
  return (
    <button
      onClick={onUse}
      disabled={disabled || !count}
      className={`pointer-events-auto flex items-center gap-2 rounded-xl border bg-abyss/70 px-3 py-2 backdrop-blur disabled:opacity-35 ${ACC[accent]}`}
    >
      <Kbd>{hotkey}</Kbd>
      <span className="text-sm text-white">{label}</span>
      <span className="font-mono text-sm">×{count || 0}</span>
    </button>
  );
}

export default function HUD({ hud, depth, zones, conditions, owned, onPowerup, onSurface }) {
  const oxygen = hud?.oxygen ?? 100;
  const zone = zones?.[hud?.zoneIndex ?? 0];
  const toGate = Math.max(0, (hud?.nextGateDepth ?? 0) - depth);
  const barColor = hud?.frozen ? "bg-gold" : oxygen > 50 ? "bg-cyan" : oxygen > 25 ? "bg-gold" : "bg-coral";
  const vis = VIS[conditions?.visibility] || VIS.clear;
  const currentArrow = !conditions ? "" : conditions.driftX > 0.05 ? "→" : conditions.driftX < -0.05 ? "←" : "·";

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {oxygen < 25 && <div className="absolute inset-0 animate-lowair" />}

      {/* Top-left: where you are */}
      <div className="absolute left-6 top-5">
        <div className="font-mono text-4xl font-semibold text-white drop-shadow">{depth} m</div>
        <div className="text-sm text-cyan">{zone?.name}</div>
        <div className="mt-1 text-xs text-textDim">Next lock in {toGate} m</div>
      </div>

      {/* Top-centre: the one number that kills you */}
      <div className="absolute left-1/2 top-6 w-[420px] -translate-x-1/2">
        <div className="mb-1 flex justify-between font-mono text-xs text-textDim">
          <span>O₂ {hud?.frozen && <span className="ml-2 text-gold">FROZEN</span>}</span>
          <span className={oxygen < 25 ? "text-coral" : "text-white"}>{Math.ceil(oxygen)}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full border border-white/15 bg-abyss/70">
          <div className={`h-full rounded-full transition-[width] duration-300 ease-linear ${barColor}`} style={{ width: `${oxygen}%` }} />
        </div>
      </div>

      {/* Top-right: score */}
      <div className="absolute right-6 top-5 text-right">
        <div className="font-mono text-3xl font-semibold text-coral drop-shadow">{hud?.score ?? 0}</div>
        <div className="flex items-center justify-end gap-3 text-sm">
          <span className="font-mono text-gold">● {hud?.coins ?? 0}</span>
          {hud?.combo > 1 && (
            <span key={hud.combo} className="animate-pop rounded-full bg-gold px-2 py-0.5 font-mono text-xs font-bold text-abyss">
              ×{hud.combo}
            </span>
          )}
        </div>
      </div>

      {/* Bottom-left: power-ups */}
      <div className="absolute bottom-6 left-6 flex gap-2">
        <PowerSlot hotkey="Q" label="Air Tank" count={owned.air_tank} accent="gold" onUse={() => onPowerup("air_tank")} />
        <PowerSlot hotkey="E" label="Time Freeze" count={owned.time_freeze} accent="coral" onUse={() => onPowerup("time_freeze")} />
        <PowerSlot hotkey="R" label="Sonar" count={owned.sonar_ping} accent="cyan" disabled onUse={() => {}} />
      </div>

      {/* Bottom-right: the REAL sea at a REAL reef, live from Open-Meteo */}
      {conditions && (
        <div className="absolute bottom-6 right-6 rounded-xl border border-white/10 bg-abyss/70 px-4 py-3 text-right backdrop-blur">
          <div className="text-sm text-white">{conditions.siteName}</div>
          <div className="mt-1 flex items-center justify-end gap-3 font-mono text-xs text-textDim">
            <span className={`rounded border px-1.5 ${vis.cls}`}>{vis.label}</span>
            <span>waves {conditions.waveHeightM} m</span>
            <span>current {currentArrow} {conditions.currentKmh} km/h</span>
            <span>{conditions.seaTempC}°C</span>
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-textDim/70">
            {conditions.source === "open-meteo" ? "live · Open-Meteo Marine API" : "offline fallback"}
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] text-textDim/70">
        WASD / arrows swim · Space dash · F fullscreen · M mute ·{" "}
        <button onClick={onSurface} className="pointer-events-auto underline hover:text-white">Esc surface</button>
      </div>
    </div>
  );
}
