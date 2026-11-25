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

/**
 * @param {Place} place
 * @param {AirData} air
 * @param {import('./types.js').Profile} profile
 */
export function analyse(place, air, profile) {
  const current = air.current;
  const index = naqi({ pm25: current.pm2_5, pm10: current.pm10 }) ?? { value: 0, dominant: /** @type {'pm25'} */ ('pm25') };
  const level = category(index.value);
  const nowIso = String(current.time ?? air.hourly.time[0] ?? '');
  const points = upcoming(air.hourly, nowIso, FORECAST.horizonHours);
  const windows = bestWindows(points, {
    length: FORECAST.windowHours, count: FORECAST.windowCount, fromHour: FORECAST.fromHour, toHour: FORECAST.toHour,
  });
  const worst = worstHour(points);
  const pm25 = Number.isFinite(current.pm2_5) ? current.pm2_5 : undefined;
  const plan = advise({ naqi: index.value, pm25, lat: place.latitude, lon: place.longitude, windows, worst }, { ...profile });
  const outing = pm25 == null ? null : outingComparison({ nowPm25: pm25, windowPm25: windows[0]?.avgPm25 ?? null });
  const context = buildContext({
    place: placeLabel(place), naqi: index.value, levelLabel: level.label, dominant: index.dominant, current, windows,
  }, profile, plan.recs);
  return { index, level, points, windows, worst, outing, plan, context };
}
