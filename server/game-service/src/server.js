// server/game-service/src/server.js
//
// game-service's ONE job: run live dives and remember how they went.
// One HTTP server, two protocols on the same port: a WebSocket for the
// live, in-dive event stream, and a couple of plain REST reads for
// leaderboard/dive-log history.
//
// This file is the TRANSLATOR between the network and the referee
// (diveRun.js). Inbound: a WebSocket message type -> one DiveRun method.
// Outbound: one DiveRun event -> one WebSocket message type. Neither side
// knows the other exists; this file is the only place that knows both.
//
// Run standalone:  PORT=4712 node src/server.js

const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');

const db = require('../../../shared/db');
const { verifyToken } = require('../../../shared/jwt');
const { DiveRun } = require('./diveRun');
const { persistRun } = require('./persistRun');
const identityClient = require('./identityClient');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/leaderboard', (req, res) => {
  const rows = db
    .prepare('SELECT username, best_score, best_depth FROM leaderboard ORDER BY best_score DESC LIMIT 20')
    .all();
  res.json({ leaderboard: rows });
});

app.get('/dive-log/:userId', (req, res) => {
  const rows = db
    .prepare(
      `SELECT depth, score, chests, coins, zone, site, duration_seconds, created_at
       FROM dive_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`
    )
    .all(req.params.userId);
  res.json({ diveLog: rows });
});

const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer });

function send(ws, type, payload = {}) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify({ type, ...payload }));
}

// OUTBOUND: every domain event the referee emits becomes exactly one
// message type. Nothing here knows WHY oxygen dropped — it just relays.
function wireRunToSocket(run, ws) {
  run.on('run:started', (p) => send(ws, 'RUN_STARTED', p));
  run.on('state', (p) => send(ws, 'STATE', p));
  run.on('collected', (p) => send(ws, 'COLLECTED', p));
  run.on('hit', (p) => send(ws, 'HIT', p));
  run.on('zone:changed', (p) => send(ws, 'ZONE_CHANGED', p));
  run.on('challenge:issued', (p) => send(ws, 'CHALLENGE', p));
  run.on('answer:result', (p) => send(ws, 'ANSWER_RESULT', p));
  run.on('gate:opened', (p) => send(ws, 'GATE_OPENED', p));
  run.on('powerup:applied', (p) => send(ws, 'POWERUP_APPLIED', p));
  run.on('powerup:denied', (p) => send(ws, 'POWERUP_DENIED', p));
  run.on('rejected', (p) => send(ws, 'REJECTED', p));
  run.on('error', (p) => send(ws, 'ERROR', p));
  run.on('run:ended', async (summary) => {
    // Save first, pay out second, THEN tell the player — so when the
    // results screen asks for the new treasure total, it's already there.
    try { persistRun(run.user, summary); } catch (err) { console.error('[game-service] persist failed', err); }
    const award = await identityClient.awardTreasure(run.user.id, summary.treasureEarned).catch(() => ({ ok: false }));
    send(ws, 'RUN_ENDED', { ...summary, treasure: award.ok ? award.treasure : null });
  });
}

wss.on('connection', (ws) => {
  let user = null;
  let authToken = null;
  let run = null;

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); }
    catch { return send(ws, 'ERROR', { message: 'invalid_json' }); }

    // Virtual identity: nothing happens on this socket until it proves who
    // it is with a JWT that identity-service signed. game-service never
    // issued that token — it can still verify it, because it's signed.
    if (!user) {
      if (msg.type !== 'AUTH') return send(ws, 'ERROR', { message: 'auth_required' });
      try {
        const claims = verifyToken(msg.token);
        user = { id: claims.sub, username: claims.username };
        authToken = msg.token;
        send(ws, 'AUTH_OK', { user });
      } catch {
        send(ws, 'ERROR', { message: 'invalid_token' });
        ws.close();
      }
      return;
    }

    // INBOUND: one message type -> one method on the referee.
    switch (msg.type) {
      case 'START_RUN':
        if (run && !run.ended) run.quit();
        run = new DiveRun(user, authToken);
        wireRunToSocket(run, ws);
        await run.start();
        break;
      case 'DEPTH':         run?.reportDepth(msg.depth); break;
      case 'COLLECT':       run?.collect(msg.kind, msg.id); break;
      case 'HIT':           run?.hit(msg.kind); break;
      case 'GATE_REACHED':  await run?.reachGate(msg.gateIndex); break;
      case 'CHEST_OPENED':  await run?.openChest(msg.chestId); break;
      case 'SUBMIT_ANSWER': await run?.submitAnswer(msg.answer); break;
      case 'USE_POWERUP':   await run?.usePowerup(msg.powerupId); break;
      case 'QUIT_RUN':      run?.quit(); break;
      default:              send(ws, 'ERROR', { message: 'unknown_message_type' });
    }
  });

  ws.on('close', () => {
    // A dropped connection mid-dive still counts as a finished run.
    if (run && !run.ended) run.quit();
  });
});

const PORT = process.env.PORT || 4712;
if (require.main === module) {
  httpServer.listen(PORT, () => console.log(`game-service listening on :${PORT}`));
}

module.exports = { app, httpServer };
