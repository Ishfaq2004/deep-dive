// server/identity-service/src/server.js
//
// identity-service's ONE job: know who someone is, and how much treasure
// and which power-ups they own. It never touches a dive_log or a
// leaderboard row — that is game-service's job. This split is the
// Engine Controller / Driving Controller example from the Low Coupling
// slides, applied to our own system: a request about scoring never
// reaches into the code that handles accounts, and vice versa.
//
// Run standalone:  PORT=4711 node src/server.js

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');

const db = require('../../../shared/db');
const { POWERUPS } = require('../../../shared/powerups');
const { signToken, verifyToken } = require('../../../shared/jwt');
const { isValidInternalKey } = require('../../../shared/internalKey');

const app = express();
app.use(cors());
app.use(express.json());

// --- Virtual identity middleware -------------------------------------
// Every protected route runs this first. It doesn't know or care WHAT the
// request is trying to do next — it only answers one question: "does this
// Authorization header prove who the caller is?" That single
// responsibility is high cohesion in miniature.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token' });
  try {
    req.auth = verifyToken(token); // { sub, username, isGuest }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    isGuest: !!row.is_guest,
    treasure: row.treasure,
  };
}

// --- Auth routes --------------------------------------------------------

app.post('/register', async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'missing_fields' });
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE email = ? OR username = ?')
    .get(email, username);
  if (existing) return res.status(409).json({ error: 'already_exists' });

  const id = uuid();
  const passwordHash = await bcrypt.hash(password, 10);
  db.prepare(
    `INSERT INTO users (id, username, email, password_hash, is_guest, treasure)
     VALUES (?, ?, ?, ?, 0, 50)`
  ).run(id, username, email, passwordHash);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || user.is_guest) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

app.post('/guest', (req, res) => {
  const id = uuid();
  const username = `guest_${id.slice(0, 6)}`;
  db.prepare(
    `INSERT INTO users (id, username, email, password_hash, is_guest, treasure)
     VALUES (?, ?, NULL, NULL, 1, 50)`
  ).run(id, username);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

// --- Profile --------------------------------------------------------------

app.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.auth.sub);
  if (!user) return res.status(404).json({ error: 'not_found' });

  const owned = db
    .prepare('SELECT powerup_id, quantity FROM owned_powerups WHERE user_id = ? AND quantity > 0')
    .all(user.id);

  res.json({ user: publicUser(user), owned });
});

// --- Dive shop --------------------------------------------------------------
// Public catalog (no auth needed to just look at prices).
app.get('/powerups', (req, res) => {
  res.json({ powerups: Object.values(POWERUPS) });
});

app.post('/shop/purchase', requireAuth, (req, res) => {
  const { powerupId } = req.body || {};
  const item = POWERUPS[powerupId];
  if (!item) return res.status(400).json({ error: 'unknown_powerup' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.auth.sub);
  if (!user) return res.status(404).json({ error: 'not_found' });
  if (user.treasure < item.price) {
    return res.status(402).json({ error: 'insufficient_treasure' });
  }

  // Single transaction: debit treasure, credit inventory. Either both
  // happen or neither does — no state where treasure vanished but the
  // power-up wasn't granted.
  const purchase = db.transaction(() => {
    db.prepare('UPDATE users SET treasure = treasure - ? WHERE id = ?').run(item.price, user.id);
    db.prepare(
      `INSERT INTO owned_powerups (user_id, powerup_id, quantity) VALUES (?, ?, 1)
       ON CONFLICT(user_id, powerup_id) DO UPDATE SET quantity = quantity + 1`
    ).run(user.id, item.id);
  });
  purchase();

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  const owned = db
    .prepare('SELECT powerup_id, quantity FROM owned_powerups WHERE user_id = ? AND quantity > 0')
    .all(user.id);
  res.json({ user: publicUser(updated), owned });
});

// --- Internal routes, used only by game-service -------------------------
// Service identity: these routes check a secret only our own services know
// (see shared/internalKey.js). A player's JWT alone is NOT enough — or any
// player could call /internal/award-treasure and pay themselves.
function requireInternal(req, res, next) {
  if (!isValidInternalKey(req.headers['x-internal-key'])) {
    return res.status(403).json({ error: 'internal_only' });
  }
  next();
}

// A dive run that uses up a power-up needs to decrement the player's
// inventory. game-service calls back into identity-service for this
// rather than writing to the owned_powerups table itself — that table
// belongs to identity-service, full stop. Two identities are checked:
// the service key (it's game-service asking) AND the player's JWT (whose
// inventory to debit).
app.post('/internal/consume-powerup', requireInternal, requireAuth, (req, res) => {
  const { powerupId } = req.body || {};
  const row = db
    .prepare('SELECT quantity FROM owned_powerups WHERE user_id = ? AND powerup_id = ?')
    .get(req.auth.sub, powerupId);
  if (!row || row.quantity < 1) {
    return res.status(409).json({ error: 'not_owned' });
  }
  db.prepare(
    'UPDATE owned_powerups SET quantity = quantity - 1 WHERE user_id = ? AND powerup_id = ?'
  ).run(req.auth.sub, powerupId);
  res.json({ ok: true });
});

// v2: coins collected during a dive become treasure — the shop's currency.
// The `users` table belongs to identity-service, so game-service asks
// instead of writing it. This closes the game's core loop:
//   dive -> collect coins -> buy power-ups -> dive deeper.
app.post('/internal/award-treasure', requireInternal, (req, res) => {
  const { userId, amount } = req.body || {};
  const coins = Number(amount);
  if (!userId || !Number.isInteger(coins) || coins < 0 || coins > 100000) {
    return res.status(400).json({ error: 'invalid_award' });
  }
  const result = db
    .prepare('UPDATE users SET treasure = treasure + ? WHERE id = ?')
    .run(coins, userId);
  if (result.changes === 0) return res.status(404).json({ error: 'not_found' });
  const { treasure } = db.prepare('SELECT treasure FROM users WHERE id = ?').get(userId);
  res.json({ ok: true, treasure });
});

const PORT = process.env.PORT || 4711;
if (require.main === module) {
  app.listen(PORT, () => console.log(`identity-service listening on :${PORT}`));
}

module.exports = app;
