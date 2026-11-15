# Deep Dive v2

Needs Node.js 22.13 or newer (uses the built-in node:sqlite; nothing to compile).

A full-screen, keyboard-controlled diving game built on the Fish API —
CIS045-3 Distributed Service Architectures.

## Layout

    deep-dive/
      shared/                  code + SQLite file used by more than one service
      server/
        identity-service/      :4711  accounts, JWTs, treasure, power-ups
        challenge-service/     :4710  Fish API puzzles (answers stay server-side)
        game-service/          :4712  live dives over WebSocket, leaderboard
      frontend/                :4700  Next.js + React + Tailwind + Phaser

## First-time setup

    cd shared && npm install && cd ..
    cd server/identity-service && npm install && cd ../..
    cd server/challenge-service && npm install && cd ../..
    cd server/game-service && npm install && cd ../..
    cd frontend && npm install && cd ..

## Run it (four terminals, from the deep-dive folder)

    cd server/challenge-service && npm start
    cd server/identity-service && npm start
    cd server/game-service && npm start
    cd frontend && npm run dev

Open http://localhost:4700, continue as guest, press Dive.

## Keys

WASD / arrows swim · Space dash · Q air tank · E time freeze · R sonar (in a puzzle)
F fullscreen · M mute · G show hitboxes · Esc surface
