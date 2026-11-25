// @ts-check
/**
 * Pure pipeline from raw API data + profile to everything the UI shows.
 * Keeping this free of DOM access makes the whole flow unit-testable.
 */

import { naqi, category } from './aqi.js';
import { FORECAST } from './config.js';
import { upcoming, bestWindows, worstHour } from './forecast.js';
import { outingComparison } from './impact.js';
import { advise } from './advisor.js';
import { buildContext } from './ai.js';
import { placeLabel } from './view.js';

/**
 * @typedef {{ name: string, admin1?: string, country?: string, latitude: number, longitude: number }} Place
 * @typedef {{ current: Record<string, any>, hourly: { time: string[], pm2_5: (number|null)[] } }} AirData
 */

/** Thrown when a location has no PM2.5/PM10 readings to analyse. */
export class NoDataError extends Error {
  constructor() {
    super('No particulate readings are available for this location right now');
    this.name = 'NoDataError';
  }
}

/**
 * Upcoming hours, the cleanest windows (best first) and the worst hour.
 * @param {AirData} air
 */
export function summariseForecast(air) {
  const nowIso = String(air.current.time ?? air.hourly.time[0] ?? '');
  const points = upcoming(air.hourly, nowIso, FORECAST.horizonHours);
  const windows = bestWindows(points, {
    length: FORECAST.windowHours,
    count: FORECAST.windowCount,
    fromHour: FORECAST.fromHour,
    toHour: FORECAST.toHour,
  });
  return { points, windows, worst: worstHour(points) };
}

/**
 * Run the full pipeline for one place.
 * @param {Place} place
 * @param {AirData} air
 * @param {import('./types.js').Profile} profile
 * @throws {NoDataError} when neither PM2.5 nor PM10 is available
 */
export function analyse(place, air, profile) {
  const { current } = air;
  const index = naqi({ pm25: current.pm2_5, pm10: current.pm10 });
  if (!index) throw new NoDataError();
  const level = category(index.value);
  const { points, windows, worst } = summariseForecast(air);
  const pm25 = Number.isFinite(current.pm2_5) ? Number(current.pm2_5) : undefined;
  const plan = advise(
    { naqi: index.value, pm25, lat: place.latitude, lon: place.longitude, windows, worst },
    { ...profile },
  );
  const outing = pm25 === undefined
    ? null
    : outingComparison({ nowPm25: pm25, windowPm25: windows[0]?.avgPm25 ?? null });
  const context = buildContext(
    {
      place: placeLabel(place),
      naqi: index.value,
      levelLabel: level.label,
      dominant: index.dominant,
      current,
      windows,
    },
    profile,
    plan.recs,
  );
  return { index, level, points, windows, worst, outing, plan, context };
}
