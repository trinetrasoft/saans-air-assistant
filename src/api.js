// @ts-check
/**
 * Open-Meteo clients (free, no API key, CORS-enabled).
 * `fetchImpl` is injectable so the functions can be unit-tested offline.
 */

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const TIMEOUT_MS = 10000;

/** Small in-memory cache so repeated lookups don't hit the network. */
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

async function getJson(url, fetchImpl) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const data = await res.json();
    cache.set(url, { at: Date.now(), data });
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/** Clear the response cache (used by tests). */
export function clearCache() {
  cache.clear();
}

/**
 * Search places by name.
 * @returns {Promise<{name:string, admin1?:string, country?:string, latitude:number, longitude:number}[]>}
 */
export async function searchPlaces(query, fetchImpl = fetch) {
  const q = String(query ?? '').trim().slice(0, 80);
  if (q.length < 2) return [];
  const url = `${GEO_URL}?${new URLSearchParams({ name: q, count: '5', language: 'en', format: 'json' })}`;
  const data = await getJson(url, fetchImpl);
  return (data.results ?? [])
    .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
    .map((r) => ({
      name: String(r.name),
      admin1: r.admin1 ? String(r.admin1) : undefined,
      country: r.country ? String(r.country) : undefined,
      latitude: r.latitude,
      longitude: r.longitude,
    }));
}

/** Validate coordinates. */
export function validCoords(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/**
 * Current conditions plus a 2-day hourly PM2.5 forecast.
 * @returns {Promise<{ current: Record<string, number|string>, hourly: { time: string[], pm2_5: (number|null)[] } }>}
 */
export async function fetchAirQuality(lat, lon, fetchImpl = fetch) {
  if (!validCoords(lat, lon)) throw new Error('Invalid coordinates');
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current: 'pm2_5,pm10,nitrogen_dioxide,ozone,carbon_monoxide,us_aqi',
    hourly: 'pm2_5',
    forecast_days: '2',
    timezone: 'auto',
  });
  const data = await getJson(`${AIR_URL}?${params}`, fetchImpl);
  if (!data || !data.current || !data.hourly) throw new Error('Unexpected air-quality response');
  return { current: data.current, hourly: data.hourly };
}
