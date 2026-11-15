// We are calling backup right here

const DIVE_SITES = [
  { id: 'red-sea',      name: 'Red Sea, Egypt',               lat: 27.30, lon: 34.05 },
  { id: 'gbr',          name: 'Great Barrier Reef, Australia', lat: -16.60, lon: 146.30 },
  { id: 'maldives',     name: 'North Malé Atoll, Maldives',    lat: 4.30, lon: 73.60 },
  { id: 'trincomalee',  name: 'Trincomalee, Sri Lanka',        lat: 8.70, lon: 81.35 },
  { id: 'belize',       name: 'Lighthouse Reef, Belize',       lat: 17.30, lon: -87.45 },
  { id: 'raja-ampat',   name: 'Raja Ampat, Indonesia',         lat: -0.60, lon: 130.40 },
];

const BASE_URL = 'https://marine-api.open-meteo.com/v1/marine';
const TIMEOUT_MS = 3000;

function pickSite() {
  return DIVE_SITES[Math.floor(Math.random() * DIVE_SITES.length)];
}

function num(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

// Pure function: raw numbers in, game-ready conditions out. Kept separate
// from the network call so it can be tested without the internet.
function classify(site, raw, source) {
  const waveHeightM = num(raw.wave_height, 0.8);
  const currentKmh = num(raw.ocean_current_velocity, 0.6);
  const currentDirDeg = num(raw.ocean_current_direction, 90);
  const seaTempC = num(raw.sea_surface_temperature, 27);

  const visibility = waveHeightM < 1 ? 'clear' : waveHeightM < 2.5 ? 'murky' : 'stormy';

  // Our ocean is a side-on slice: left/right is west/east. So only the
  // current's east-west component pushes the diver. Compass degrees:
  // 90 = flowing east (push right), 270 = flowing west (push left).
  const eastWest = Math.sin((currentDirDeg * Math.PI) / 180);
  const driftX = Math.max(-1, Math.min(1, (eastWest * currentKmh) / 3));

  return {
    siteId: site.id,
    siteName: site.name,
    waveHeightM: Math.round(waveHeightM * 10) / 10,
    currentKmh: Math.round(currentKmh * 10) / 10,
    currentDirDeg: Math.round(currentDirDeg),
    seaTempC: Math.round(seaTempC),
    visibility,
    driftX: Math.round(driftX * 100) / 100, // -1..1, the client scales it into a force
    source,
  };
}

async function getDiveConditions(site = pickSite()) {
  const url =
    `${BASE_URL}?latitude=${site.lat}&longitude=${site.lon}` +
    '&current=wave_height,ocean_current_velocity,ocean_current_direction,sea_surface_temperature';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
    const data = await res.json();
    if (!data.current) throw new Error('No `current` block in response');
    return classify(site, data.current, 'open-meteo');
  } catch (err) {
    console.warn('[conditionsClient] Open-Meteo unavailable, using calm fallback:', err.message);
    return classify(site, { wave_height: 0.6, ocean_current_velocity: 0.5, ocean_current_direction: 90, sea_surface_temperature: 27 }, 'fallback');
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { getDiveConditions, classify, DIVE_SITES };
