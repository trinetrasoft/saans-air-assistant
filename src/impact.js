// @ts-check
/**
 * Quantified impact of choices, so advice is not just "do X" but
 * "doing X means you breathe this much less".
 *
 * Inhaled dose (µg) = concentration (µg/m³) × breathing rate (m³/h) × hours.
 * Breathing rates are typical adult values from the US EPA Exposure Factors
 * Handbook (ch. 6), rounded: ~0.5 m³/h at rest, ~1.2 m³/h light activity
 * (walking, errands), ~3 m³/h moderate exercise. Results are estimates.
 */

export const BREATHING_RATE_M3_PER_H = Object.freeze({ rest: 0.5, light: 1.2, exercise: 3 });

/** Filtration efficiency of a well-fitted N95 for fine particles (rated ≥95%). */
export const N95_EFFICIENCY = 0.95;

/**
 * @param {number} pm25 µg/m³
 * @param {number} hours
 * @param {keyof typeof BREATHING_RATE_M3_PER_H} activity
 * @returns {number} inhaled PM2.5 in µg (rounded)
 */
export function inhaledDose(pm25, hours, activity = 'light') {
  if (!Number.isFinite(pm25) || !Number.isFinite(hours) || pm25 < 0 || hours < 0) return 0;
  return Math.round(pm25 * BREATHING_RATE_M3_PER_H[activity] * hours);
}

/**
 * Percentage reduction when moving from `from` to `to` concentration.
 * @param {number} from
 * @param {number} to
 * @returns {number} 0-100, rounded
 */
export function percentReduction(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - to / from) * 100)));
}

/**
 * Compare a 1-hour outing now vs in the cleanest window, and with an N95.
 * @param {{ nowPm25: number, windowPm25?: number|null }} a
 */
export function outingComparison({ nowPm25, windowPm25 }) {
  const now = inhaledDose(nowPm25, 1);
  const inWindow = windowPm25 == null ? null : inhaledDose(windowPm25, 1);
  const withMask = Math.round(now * (1 - N95_EFFICIENCY));
  return {
    now,
    inWindow,
    withMask,
    windowSaving: inWindow == null ? 0 : percentReduction(now, inWindow),
    maskSaving: percentReduction(now, withMask),
  };
}

/**
 * Delhi-NCR bounding box (approx.) where CAQM's GRAP applies.
 * @param {number} lat
 * @param {number} lon
 */
export function inDelhiNcr(lat, lon) {
  return lat >= 27.9 && lat <= 29.3 && lon >= 76.4 && lon <= 78.1;
}

/**
 * Graded Response Action Plan stage implied by an AQI value (CAQM, Delhi-NCR).
 * @param {number} aqi
 * @returns {{ stage: 'I'|'II'|'III'|'IV', label: string, measures: string } | null}
 */
export function grapStage(aqi) {
  if (!Number.isFinite(aqi) || aqi <= 200) return null;
  if (aqi <= 300) return { stage: 'I', label: 'Poor', measures: 'dust control at construction sites, no open burning, strict checks on polluting vehicles.' };
  if (aqi <= 400) return { stage: 'II', label: 'Very Poor', measures: 'curbs on diesel generators and coal/firewood in eateries, higher parking fees to discourage private vehicles, more metro and bus services.' };
  if (aqi <= 450) return { stage: 'III', label: 'Severe', measures: 'halt on most construction and demolition, restrictions on older petrol and diesel cars, possible hybrid classes for young children.' };
  return { stage: 'IV', label: 'Severe+', measures: 'entry curbs on trucks, restrictions on non-essential diesel vehicles, and schools and offices may shift online.' };
}
