// shared/powerups.js
//
// One catalog, required by three different places: the dive-shop page
// (to render prices), identity-service (to validate a purchase and debit
// treasure), and game-service (to know what an owned power-up actually
// DOES during a run). Keeping it in one shared file instead of three copies
// is itself a small low-coupling decision: if a price changes, it changes
// in exactly one place, not three.

const POWERUPS = {
  sonar_ping: {
    id: 'sonar_ping',
    name: 'Sonar Ping',
    price: 30,
    description: 'Press R during a puzzle: reveals the fish count for 2.5 seconds.',
  },
  air_tank: {
    id: 'air_tank',
    name: 'Air Tank',
    price: 45,
    description: 'Press Q mid-dive: instantly +25% oxygen.',
  },
  time_freeze: {
    id: 'time_freeze',
    name: 'Time Freeze',
    price: 60,
    description: 'Press E mid-dive: oxygen and creatures freeze for 5 seconds.',
  },
};

module.exports = { POWERUPS };
