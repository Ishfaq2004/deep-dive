// server/game-service/src/identityClient.js
//
// The calls game-service makes back into identity-service. game-service
// never touches the `users` or `owned_powerups` TABLES — it asks, over
// HTTP, and identity-service decides. Each service stays the only thing
// that ever writes its own data.
//
// Every call carries the service key (x-internal-key): "this request is
// from game-service". consumePowerup also forwards the player's JWT:
// "...on behalf of THIS player".

const { INTERNAL_API_KEY } = require('../../../shared/internalKey');

const BASE_URL = process.env.IDENTITY_SERVICE_URL || 'http://localhost:4711';

async function consumePowerup(token, powerupId) {
  const res = await fetch(`${BASE_URL}/internal/consume-powerup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-internal-key': INTERNAL_API_KEY,
    },
    body: JSON.stringify({ powerupId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body.error || 'consume_failed' };
  }
  return { ok: true };
}

async function awardTreasure(userId, amount) {
  const res = await fetch(`${BASE_URL}/internal/award-treasure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-key': INTERNAL_API_KEY },
    body: JSON.stringify({ userId, amount }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body.error || 'award_failed' };
  }
  return res.json(); // { ok: true, treasure }
}

module.exports = { consumePowerup, awardTreasure };
