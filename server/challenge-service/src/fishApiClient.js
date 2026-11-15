const FISH_API_URL = 'https://marcconrad.com/uob/fish/api.php?out=json';
const TIMEOUT_MS = 4000;

async function fetchPuzzle() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(FISH_API_URL, { signal: controller.signal });
    if (!response.ok) throw new Error(`Fish API responded ${response.status}`);
    const data = await response.json();
    // Real API shape: { question: "<image url>", fish: <n>, chest: <n> }
    if (typeof data.fish !== 'number') throw new Error('Unexpected Fish API shape');
    return { question: data.question, fish: data.fish, chest: data.chest ?? 0, source: 'fish-api' };
  } catch (err) {
    console.warn('[fishApiClient] Fish API unavailable, using a drawn fallback puzzle:', err.message);
    return makeFallbackPuzzle();
  } finally {
    clearTimeout(timer);
  }
}

// --- Fallback: draw our own puzzle -----------------------------------------

function makeFallbackPuzzle() {
  const fish = 3 + Math.floor(Math.random() * 7); // 3..9 fish
  const chest = Math.floor(Math.random() * 4);
  return { question: drawPuzzleSvg(fish), fish, chest, source: 'fallback' };
}

function drawPuzzleSvg(count) {
  const W = 480, H = 320;
  const placed = [];
  const parts = [];
  let attempts = 0;
  // Scatter fish without overlaps, so the count is fair.
  while (placed.length < count && attempts < 500) {
    attempts++;
    const x = 50 + Math.random() * (W - 100);
    const y = 40 + Math.random() * (H - 110);
    if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < 62)) continue;
    placed.push({ x, y });
    const flip = Math.random() < 0.5 ? -1 : 1;
    const hue = [28, 45, 190, 330][Math.floor(Math.random() * 4)];
    parts.push(
      `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) scale(${flip} 1)">` +
        `<ellipse rx="22" ry="12" fill="hsl(${hue} 85% 60%)"/>` +
        `<path d="M-20 0 L-34 -10 L-34 10 Z" fill="hsl(${hue} 85% 50%)"/>` +
        `<circle cx="11" cy="-3" r="3" fill="#0a1628"/>` +
      `</g>`
    );
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<defs><linearGradient id="w" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#1e6f9f"/><stop offset="1" stop-color="#0b2a48"/></linearGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#w)"/>` +
    `<path d="M0 ${H - 40} Q120 ${H - 60} 240 ${H - 42} T${W} ${H - 46} V${H} H0 Z" fill="#c9a46a"/>` +
    parts.join('') +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

module.exports = { fetchPuzzle };
