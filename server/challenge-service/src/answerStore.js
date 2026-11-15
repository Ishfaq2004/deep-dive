// server/challenge-service/src/answerStore.js
//
// Why challengeId exists at all (the question you asked a while back):
// the browser is told "here's a puzzle, how many fish?" but is never told
// the answer — if it were, anyone could read it out of the network tab.
// So the correct count has to live somewhere on the SERVER between
// "here's the puzzle" and "here's the guess", keyed by something both
// requests share. That key is challengeId. This store is that short-term
// memory: one challengeId -> one correct answer, used once, then gone.

const crypto = require('crypto');

const pending = new Map(); // challengeId -> { fish, chest, expiresAt }
const TTL_MS = 2 * 60 * 1000; // a stale, unanswered puzzle expires after 2 min

function create(puzzle) {
  const challengeId = crypto.randomUUID();
  pending.set(challengeId, {
    fish: puzzle.fish,
    chest: puzzle.chest,
    expiresAt: Date.now() + TTL_MS,
  });
  return challengeId;
}

function peek(challengeId) {
  const entry = pending.get(challengeId);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return { fish: entry.fish }; // read-only — does NOT consume the challenge
}

function verify(challengeId, answer) {
  const entry = pending.get(challengeId);
  if (!entry) return { status: 'not_found' };
  if (Date.now() > entry.expiresAt) {
    pending.delete(challengeId);
    return { status: 'expired' };
  }

  pending.delete(challengeId); // one attempt per challenge
  const correct = Number(answer) === entry.fish;
  return { status: 'ok', correct, correctAnswer: entry.fish, chest: entry.chest };
}

// Reap anything that expired without ever being answered, so the Map
// doesn't grow unbounded over a long session.
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of pending) {
    if (now > entry.expiresAt) pending.delete(id);
  }
}, 30 * 1000).unref();

module.exports = { create, verify, peek };
