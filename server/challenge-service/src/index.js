// server/challenge-service/src/index.js
//
// challenge-service's ONE job: hand out a fish-counting puzzle, and later
// say whether a guess about THAT specific puzzle was right. It has never
// heard of oxygen, combos, treasure, or WebSockets — those are
// game-service's problem. That's high cohesion: every line in this file
// is about one thing, puzzles.
//
// Run standalone:  PORT=4710 node src/index.js

const express = require('express');
const { fetchPuzzle } = require('./fishApiClient');
const answerStore = require('./answerStore');

const app = express();
app.use(express.json());

app.get('/challenge', async (req, res) => {
  try {
    const puzzle = await fetchPuzzle();
    const challengeId = answerStore.create(puzzle);
    // Note what's withheld: `fish` (the correct count) never leaves this
    // response. The browser gets the image and an id, nothing else.
    res.json({ challengeId, imageUrl: puzzle.question, source: puzzle.source });
  } catch (err) {
    console.error('[challenge-service] /challenge failed:', err);
    res.status(502).json({ error: 'puzzle_unavailable' });
  }
});

// Internal only — never call this from the browser. game-service uses it
// for exactly one thing: the Sonar Ping power-up, which is a deliberate,
// paid, time-limited reveal of the real count. It's the one narrow case
// where the server trusts the client with the answer on purpose, and
// it's a server-to-server call, never exposed on the public surface.
app.get('/internal/peek/:challengeId', (req, res) => {
  const result = answerStore.peek(req.params.challengeId);
  if (!result) return res.status(404).json({ error: 'unknown_challenge' });
  res.json(result);
});

app.post('/answer', (req, res) => {
  const { challengeId, answer } = req.body || {};
  if (!challengeId || answer === undefined) {
    return res.status(400).json({ error: 'missing_fields' });
  }

  const result = answerStore.verify(challengeId, answer);
  if (result.status === 'not_found') return res.status(404).json({ error: 'unknown_challenge' });
  if (result.status === 'expired') return res.status(410).json({ error: 'challenge_expired' });

  res.json({
    correct: result.correct,
    correctAnswer: result.correctAnswer,
    chest: result.chest,
  });
});

const PORT = process.env.PORT || 4710;
if (require.main === module) {
  app.listen(PORT, () => console.log(`challenge-service listening on :${PORT}`));
}

module.exports = app;
