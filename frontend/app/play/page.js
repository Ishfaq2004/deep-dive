"use client";

// app/play/page.js
//
// The dive, full screen. This page is the CONDUCTOR. It owns:
//   - the Phaser game (through PhaserGame + the "remote" from createGame)
//   - the WebSocket (through GameSocketProvider)
//   - the bus between them, wired up by connectBridge()
//   - the React overlays: HUD, puzzle, briefing, results
//
// The page itself is a small state machine:
//   briefing -> connecting -> diving -> ended -> (dive again) -> connecting ...
// Each server message moves it along or updates what's on screen.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import RequireAuth from "../../components/RequireAuth";
import HUD from "../../components/game/HUD";
import PuzzleOverlay from "../../components/game/PuzzleOverlay";
import RunSummary from "../../components/game/RunSummary";
import Briefing from "../../components/game/Briefing";
import { useAuth } from "../AuthProvider";
import { useGameSocket } from "../GameSocketProvider";
import { identityApi } from "../../lib/api";
import { createBus, EVT } from "../../game/bus";
import { connectBridge } from "../../game/bridge";
import { unlock, sfx } from "../../game/sfx";

// Client-only: Phaser can't run during Next's server render.
const PhaserGame = dynamic(() => import("../../components/game/PhaserGame"), { ssr: false });

function ownedMap(list) {
  const map = {};
  list.forEach((o) => (map[o.powerup_id] = o.quantity));
  return map;
}

function PlayContent() {
  const { token, refreshMe } = useAuth();
  const { connect, send, subscribe } = useGameSocket();
  // Only the stable functions — not the provider's whole value object, which
  // is a new object on every render and would re-run our effects each time.
  const socket = useMemo(() => ({ connect, send, subscribe }), [connect, send, subscribe]);
  const [bus] = useState(createBus);          // one bus for the page's whole life
  const gameRef = useRef(null);
  const phaseRef = useRef("briefing");

  const [phase, setPhaseState] = useState("briefing"); // briefing | connecting | diving | ended
  const [ready, setReady] = useState(false);
  const [run, setRun] = useState(null);
  const [hud, setHud] = useState(null);
  const [depth, setDepth] = useState(0);
  const [owned, setOwned] = useState({});
  const [puzzle, setPuzzle] = useState(null);
  const [sonar, setSonar] = useState(null);
  const [summary, setSummary] = useState(null);
  const [banner, setBanner] = useState(null);
  const [confirmSurface, setConfirmSurface] = useState(false);
  const holdPuzzleUntil = useRef(0);

  const setPhase = useCallback((p) => { phaseRef.current = p; setPhaseState(p); }, []);
  const flash = useCallback((text, tone = "cyan") => setBanner({ text, tone, key: Date.now() }), []);

  const loadKit = useCallback(() => {
    identityApi.me(token).then(({ owned }) => setOwned(ownedMap(owned))).catch(() => {});
  }, [token]);

  useEffect(loadKit, [loadKit]);

  // --- Wire everything up once --------------------------------------------
  useEffect(() => {
    const offs = [
      connectBridge(bus, socket),
      bus.on(EVT.READY, () => setReady(true)),
      bus.on(EVT.DEPTH, ({ depth }) => setDepth(depth)),
      bus.on(EVT.SURFACE, () => phaseRef.current === "diving" && setConfirmSurface((v) => !v)),

      socket.subscribe("RUN_STARTED", (msg) => {
        setRun(msg);
        setHud(msg.state);
        setDepth(0);
        setSummary(null);
        setPuzzle(null);
        gameRef.current?.startDive(msg);
        setPhase("diving");
        const c = msg.conditions;
        flash(`Diving at ${c.siteName} · ${c.visibility} · current ${c.currentKmh} km/h · ${c.seaTempC}°C`);
      }),
      socket.subscribe("STATE", (msg) => setHud(msg)),
      socket.subscribe("ZONE_CHANGED", (msg) => flash(`Entering the ${msg.zone.name}`, "zone")),
      socket.subscribe("CHALLENGE", (msg) => {
        // If the player is still reading "It was 7", wait before swapping the picture.
        const wait = Math.max(0, holdPuzzleUntil.current - Date.now());
        setTimeout(() => {
          setSonar(null);
          setPuzzle({ ...msg, result: null });
          bus.emit(EVT.PUZZLE_OPEN);
        }, wait);
      }),
      socket.subscribe("ANSWER_RESULT", (msg) => {
        setPuzzle((p) => (p ? { ...p, result: msg } : p));
        holdPuzzleUntil.current = Date.now() + 1400;
        const closes = msg.correct || msg.context === "chest";
        if (closes) {
          setTimeout(() => {
            setPuzzle(null);
            setSonar(null);
            bus.emit(EVT.PUZZLE_CLOSE);
          }, 1300);
        }
      }),
      socket.subscribe("POWERUP_APPLIED", (msg) => {
        setOwned((o) => ({ ...o, [msg.powerupId]: Math.max(0, (o[msg.powerupId] || 1) - 1) }));
        if (msg.powerupId === "sonar_ping") {
          setSonar(msg.reveal);
          setTimeout(() => setSonar(null), msg.forMs);
        }
      }),
      socket.subscribe("POWERUP_DENIED", (msg) =>
        flash(msg.error === "not_owned" ? "None left — buy more in the Dive Shop" : "Can't use that right now", "coral")
      ),
      socket.subscribe("ERROR", (msg) => {
        if (msg.message === "puzzle_unavailable" || msg.message === "answer_check_failed") {
          setPuzzle(null);
          bus.emit(EVT.PUZZLE_CLOSE);
          flash("The puzzle service didn't answer — touch the lock again", "coral");
        }
      }),
      socket.subscribe("RUN_ENDED", (msg) => {
        setSummary(msg);
        setPuzzle(null);
        setConfirmSurface(false);
        setPhase("ended");
        refreshMe();
        loadKit();
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [bus, socket, flash, setPhase, refreshMe, loadKit]);

  // Leaving the page mid-dive ends the run properly.
  useEffect(() => () => { if (phaseRef.current === "diving") socket.send("QUIT_RUN"); }, [socket]);

  // Banner fades itself out.
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 3600);
    return () => clearTimeout(t);
  }, [banner]);

  async function startDive() {
    unlock(); // browsers only allow sound after a click
    setPhase("connecting");
    try {
      await socket.connect(token);
      socket.send("START_RUN");
    } catch {
      setPhase("briefing");
      flash("Couldn't reach game-service on :4712", "coral");
    }
  }

  const requestPowerup = useCallback((powerupId) => bus.emit(EVT.POWERUP, { powerupId }), [bus]);
  const onSonar = useCallback(() => requestPowerup("sonar_ping"), [requestPowerup]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#020814]">
      <PhaserGame bus={bus} onReady={(handle) => (gameRef.current = handle)} />

      {phase === "diving" && (
        <HUD
          hud={hud}
          depth={depth}
          zones={run?.rules.zones}
          conditions={run?.conditions}
          owned={owned}
          onPowerup={requestPowerup}
          onSurface={() => setConfirmSurface(true)}
        />
      )}

      {banner && (
        <div key={banner.key} className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 animate-banner">
          <div
            className={`rounded-full border px-6 py-2 text-center font-display backdrop-blur ${
              banner.tone === "zone"
                ? "border-cyan/50 bg-abyss/80 text-2xl font-bold uppercase tracking-widest text-cyan"
                : banner.tone === "coral"
                ? "border-coral/40 bg-abyss/80 text-sm text-coral"
                : "border-white/15 bg-abyss/70 text-sm text-white"
            }`}
          >
            {banner.text}
          </div>
        </div>
      )}

      {puzzle && phase === "diving" && (
        <PuzzleOverlay
          puzzle={puzzle}
          oxygen={hud?.oxygen ?? 0}
          sonar={sonar}
          sonarCount={owned.sonar_ping}
          onSonar={onSonar}
          onSubmit={(answer) => {
            sfx.chest();
            socket.send("SUBMIT_ANSWER", { answer });
          }}
        />
      )}

      {confirmSurface && phase === "diving" && (
        <div className="absolute inset-0 flex items-center justify-center bg-abyss/50">
          <div className="rounded-2xl border border-white/10 bg-mid/95 p-6 text-center">
            <p className="mb-1 text-lg text-white">Surface now and end the dive?</p>
            <p className="mb-4 text-xs text-textDim">There's no pause — your air is on the server's clock.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => socket.send("QUIT_RUN")} className="rounded-lg bg-coral px-4 py-2 font-semibold text-abyss">Surface</button>
              <button onClick={() => setConfirmSurface(false)} className="rounded-lg border border-white/15 px-4 py-2 text-white">Keep diving</button>
            </div>
          </div>
        </div>
      )}

      {(phase === "briefing" || phase === "connecting") && (
        <Briefing ready={ready} busy={phase === "connecting"} owned={owned} onStart={startDive} />
      )}

      {phase === "ended" && summary && <RunSummary summary={summary} onDiveAgain={startDive} />}
    </div>
  );
}

export default function PlayPage() {
  return (
    <RequireAuth>
      <PlayContent />
    </RequireAuth>
  );
}
