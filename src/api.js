// @ts-check
/**
 * Open-Meteo clients (free, no API key, CORS-enabled).
 * `fetchImpl` is injectable so the functions can be unit-tested offline.
 */

import { ENDPOINTS, NETWORK, INPUT_LIMITS } from './config.js';

/** Small bounded in-memory cache so repeated lookups don't hit the network. */
const cache = new Map();

/**
 * GET JSON with a timeout and a TTL cache (oldest entry evicted when full).
 * @param {string} url
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<any>}
 */
async function getJson(url, fetchImpl) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < NETWORK.cacheTtlMs) return hit.data;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NETWORK.timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const data = await res.json();
    if (cache.size >= NETWORK.cacheMaxEntries) cache.delete(cache.keys().next().value);
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
 * @param {string} query
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{name:string, admin1?:string, country?:string, latitude:number, longitude:number}[]>}
 */
export async function searchPlaces(query, fetchImpl = fetch) {
  const q = String(query ?? '').trim().slice(0, INPUT_LIMITS.placeQueryMax);
  if (q.length < INPUT_LIMITS.placeQueryMin) return [];
  const params = new URLSearchParams({ name: q, count: String(NETWORK.maxPlaces), language: 'en', format: 'json' });
  const url = `${ENDPOINTS.geocoding}?${params}`;
  const data = await getJson(url, fetchImpl);
  /** @type {Array<Record<string, any>>} */
  const results = data.results ?? [];
  return results
    .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
    .map((r) => ({
      name: String(r.name),
      admin1: r.admin1 ? String(r.admin1) : undefined,
      country: r.country ? String(r.country) : undefined,
      latitude: r.latitude,
      longitude: r.longitude,
    }));
}

/**
 * Validate coordinates.
 * @param {number} lat
 * @param {number} lon
 */
export function validCoords(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/**
 * Current conditions plus an hourly PM2.5 forecast.
 * @param {number} lat
 * @param {number} lon
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{ current: Record<string, number|string>, hourly: { time: string[], pm2_5: (number|null)[] } }>}
 */
export async function fetchAirQuality(lat, lon, fetchImpl = fetch) {
  if (!validCoords(lat, lon)) throw new Error('Invalid coordinates');
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current: 'pm2_5,pm10,nitrogen_dioxide,ozone,carbon_monoxide,us_aqi',
    hourly: 'pm2_5',
    forecast_days: String(NETWORK.forecastDays),
    timezone: 'auto',
  });
  const data = await getJson(`${ENDPOINTS.airQuality}?${params}`, fetchImpl);
  if (!data || !data.current || !data.hourly) throw new Error('Unexpected air-quality response');
  return { current: data.current, hourly: data.hourly };
}
