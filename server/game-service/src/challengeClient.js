// server/game-service/src/challengeClient.js
//
// game-service talking to challenge-service. Same three-part shape as
// calling the Fish API, just one hop closer to home: Logic = this fetch
// wrapper, Location = CHALLENGE_SERVICE_URL, Protocol = HTTP + JSON. Two
// of our own services, built and deployed independently, cooperating only
// through this interface — neither knows the other's internals, which is
// the low-coupling half of the same coin.

const BASE_URL = process.env.CHALLENGE_SERVICE_URL || 'http://localhost:4710';

async function getChallenge() {
  const res = await fetch(`${BASE_URL}/challenge`);
  if (!res.ok) throw new Error(`challenge-service /challenge failed: ${res.status}`);
  return res.json(); // { challengeId, imageUrl, source }
}

async function submitAnswer(challengeId, answer) {
  const res = await fetch(`${BASE_URL}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId, answer }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || 'answer_failed'), { status: res.status });
  }
  return res.json(); // { correct, correctAnswer, chest }
}

async function peekChallenge(challengeId) {
  const res = await fetch(`${BASE_URL}/internal/peek/${challengeId}`);
  if (!res.ok) return null;
  return res.json(); // { fish }
}

module.exports = { getChallenge, submitAnswer, peekChallenge };
