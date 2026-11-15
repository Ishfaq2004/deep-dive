// server/game-service/src/persistRun.js
//
// game-service owns dive_logs and leaderboard — identity-service never
// touches these tables, same way game-service never touches users or
// owned_powerups. One write, in one place, when a run ends.

const { randomUUID } = require('crypto');
const db = require('../../../shared/db');

function persistRun(user, result) {
  db.prepare(
    `INSERT INTO dive_logs (id, user_id, depth, score, chests, coins, zone, site, duration_seconds)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(), user.id, result.maxDepth, result.score, result.chests,
    result.coins, result.zone, result.site, result.durationSeconds
  );

  // One statement handles both "first run ever" and "beat my best".
  db.prepare(
    `INSERT INTO leaderboard (user_id, username, best_score, best_depth)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       best_score = MAX(best_score, excluded.best_score),
       best_depth = MAX(best_depth, excluded.best_depth),
       updated_at = datetime('now')`
  ).run(user.id, user.username, result.score, result.maxDepth);
}

module.exports = { persistRun };
