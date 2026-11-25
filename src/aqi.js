/**
 * Air-quality index helpers.
 *
 * India's National Air Quality Index (NAQI, CPCB) is computed from pollutant
 * sub-indices; the overall index is the maximum sub-index. We implement the
 * PM2.5 and PM10 sub-indices (the pollutants that dominate winter smog) using
 * the official CPCB breakpoints and linear interpolation.
 */

/** @typedef {{ lo: number, hi: number, iLo: number, iHi: number }} Breakpoint */

/** CPCB breakpoints in µg/m³ (24-hour averages). */
export const BREAKPOINTS = Object.freeze({
  pm25: Object.freeze([
    { lo: 0, hi: 30, iLo: 0, iHi: 50 },
    { lo: 31, hi: 60, iLo: 51, iHi: 100 },
    { lo: 61, hi: 90, iLo: 101, iHi: 200 },
    { lo: 91, hi: 120, iLo: 201, iHi: 300 },
    { lo: 121, hi: 250, iLo: 301, iHi: 400 },
    { lo: 251, hi: 500, iLo: 401, iHi: 500 },
  ]),
  pm10: Object.freeze([
    { lo: 0, hi: 50, iLo: 0, iHi: 50 },
    { lo: 51, hi: 100, iLo: 51, iHi: 100 },
    { lo: 101, hi: 250, iLo: 101, iHi: 200 },
    { lo: 251, hi: 350, iLo: 201, iHi: 300 },
    { lo: 351, hi: 430, iLo: 301, iHi: 400 },
    { lo: 431, hi: 600, iLo: 401, iHi: 500 },
  ]),
});

export const CATEGORIES = Object.freeze([
  { max: 50, key: 'good', label: 'Good', advice: 'Minimal impact.' },
  { max: 100, key: 'satisfactory', label: 'Satisfactory', advice: 'Minor breathing discomfort for sensitive people.' },
  { max: 200, key: 'moderate', label: 'Moderate', advice: 'Discomfort for people with lung or heart disease, children and older adults.' },
  { max: 300, key: 'poor', label: 'Poor', advice: 'Breathing discomfort for most people on prolonged exposure.' },
  { max: 400, key: 'very-poor', label: 'Very Poor', advice: 'Respiratory illness on prolonged exposure.' },
  { max: Infinity, key: 'severe', label: 'Severe', advice: 'Affects healthy people and seriously impacts those with existing disease.' },
]);

/**
 * Sub-index for one pollutant concentration.
 * Concentrations between integer breakpoints (e.g. 30.5) are assigned to the
 * upper band, and anything above the table is capped at 500.
 * @param {number} conc concentration in µg/m³
 * @param {readonly Breakpoint[]} table
 * @returns {number|null} rounded sub-index, or null for invalid input
 */
export function subIndex(conc, table) {
  if (typeof conc !== 'number' || !Number.isFinite(conc) || conc < 0) return null;
  const last = table[table.length - 1];
  if (conc >= last.hi) return last.iHi;
  const bp = table.find((b) => conc <= b.hi) ?? last;
  const c = Math.max(conc, bp.lo); // values in the gap (e.g. 30.5) start the next band
  return Math.round(((bp.iHi - bp.iLo) / (bp.hi - bp.lo)) * (c - bp.lo) + bp.iLo);
}

/**
 * Overall NAQI from PM2.5 and PM10 (max of available sub-indices).
 * @param {{ pm25?: number|null, pm10?: number|null }} c
 * @returns {{ value: number, dominant: 'pm25'|'pm10' } | null}
 */
export function naqi({ pm25, pm10 }) {
  const a = pm25 == null ? null : subIndex(pm25, BREAKPOINTS.pm25);
  const b = pm10 == null ? null : subIndex(pm10, BREAKPOINTS.pm10);
  if (a == null && b == null) return null;
  if (b == null || (a != null && a >= b)) return { value: a, dominant: 'pm25' };
  return { value: b, dominant: 'pm10' };
}

/**
 * @param {number} value NAQI value
 */
export function category(value) {
  return CATEGORIES.find((c) => value <= c.max) ?? CATEGORIES[CATEGORIES.length - 1];
}
