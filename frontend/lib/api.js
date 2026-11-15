// lib/api.js
//
// Every REST call the frontend makes to identity-service, in one place.
// A page component never calls fetch() directly against a service URL —
// it calls one of these. That's the UI/API boundary: pages know nothing
// about headers, base URLs, or error shapes, only "give me the user" or
// "buy this power-up".

const IDENTITY_URL = process.env.NEXT_PUBLIC_IDENTITY_URL || "http://localhost:4711";
const GAME_HTTP_URL = process.env.NEXT_PUBLIC_GAME_HTTP_URL || "http://localhost:4712";

async function asJson(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(body.error || "request_failed"), { status: res.status, body });
  }
  return body;
}

export const identityApi = {
  register: (username, email, password) =>
    fetch(`${IDENTITY_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    }).then(asJson),

  login: (email, password) =>
    fetch(`${IDENTITY_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).then(asJson),

  guest: () => fetch(`${IDENTITY_URL}/guest`, { method: "POST" }).then(asJson),

  me: (token) =>
    fetch(`${IDENTITY_URL}/me`, { headers: { Authorization: `Bearer ${token}` } }).then(asJson),

  powerups: () => fetch(`${IDENTITY_URL}/powerups`).then(asJson),

  purchase: (token, powerupId) =>
    fetch(`${IDENTITY_URL}/shop/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ powerupId }),
    }).then(asJson),
};

export const gameApi = {
  leaderboard: () => fetch(`${GAME_HTTP_URL}/leaderboard`).then(asJson),
  diveLog: (userId) => fetch(`${GAME_HTTP_URL}/dive-log/${userId}`).then(asJson),
};
