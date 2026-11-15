// shared/internalKey.js
//
// The SECOND kind of identity in this project.
//
//   A JWT proves WHICH PLAYER is asking.   ("I am Diver_07.")
//   This key proves WHICH SERVICE is asking. ("I am game-service.")
//
// Some routes must only ever be called by our own services, never by a
// player — e.g. "give this user 40 treasure". If that route only checked
// the player's JWT, any player could call it with their own token and
// award themselves infinite treasure. So it checks a secret that only our
// services know, sent in an `x-internal-key` header.
//
// In production this comes from an environment variable set on the server
// (never committed to git). Here it falls back to a dev default so the
// project runs with zero setup — same pattern as JWT_SECRET in jwt.js.

const crypto = require('crypto');

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'deep-dive-internal-dev-key';

// Compare in constant time, so an attacker can't guess the key one
// character at a time by measuring how fast a wrong guess is rejected.
function isValidInternalKey(candidate) {
  if (typeof candidate !== 'string') return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(INTERNAL_API_KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { INTERNAL_API_KEY, isValidInternalKey };
