// shared/jwt.js
//
// Both services need the same secret: identity-service SIGNS a token at
// login, game-service VERIFIES that same token when a socket connects.
// This is virtual identity working across a service boundary — the two
// services have never talked to each other directly, yet game-service can
// still confirm "this connection really is the user identity-service
// logged in", purely from the signed token. In production JWT_SECRET
// would be an environment variable injected by the deploy platform, never
// committed; here it falls back to a dev default so the project runs with
// zero setup.

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'deep-dive-dev-secret-change-me';

function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, isGuest: !!user.is_guest },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET); // throws if invalid/expired
}

module.exports = { signToken, verifyToken, JWT_SECRET };
