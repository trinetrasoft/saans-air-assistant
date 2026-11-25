// @ts-check
/**
 * Forecast analysis: find the cleanest windows for outdoor activity and
 * ventilation from an hourly PM2.5 forecast.
 */

/**
 * @typedef {{ time: string, pm25: number }} HourPoint  time is local ISO "YYYY-MM-DDTHH:MM"
 * @typedef {{ start: string, end: string, avgPm25: number }} Window
 */

/**
 * Hour (0-23) of a local ISO timestamp without relying on the runtime timezone.
 * @param {string} iso
 * @returns {number} NaN when the timestamp is malformed
 */
export function hourOf(iso) {
  const m = /T(\d{2}):/.exec(iso);
  return m ? Number(m[1]) : NaN;
}

/**
 * Zip Open-Meteo hourly arrays into points, keeping only the next `hours`
 * entries at or after `nowIso` and dropping missing values.
 * @param {{ time: string[], pm2_5: (number|null)[] }} hourly
 * @param {string} nowIso
 * @param {number} [hours=24]
 * @returns {HourPoint[]}
 */
export function upcoming(hourly, nowIso, hours = 24) {
  if (!hourly || !Array.isArray(hourly.time)) return [];
  const nowHour = nowIso.slice(0, 13);
  const out = [];
  for (let i = 0; i < hourly.time.length && out.length < hours; i += 1) {
    const t = hourly.time[i];
    const v = hourly.pm2_5?.[i];
    if (t.slice(0, 13) >= nowHour && typeof v === 'number' && Number.isFinite(v)) {
      out.push({ time: t, pm25: v });
    }
  }
  return out;
}

/**
 * Best contiguous windows of `length` hours by lowest mean PM2.5 (cleanest
 * first), limited to
 * waking hours [fromHour, toHour). Windows do not overlap.
 * @param {HourPoint[]} points consecutive hourly points
 * @param {{ length?: number, count?: number, fromHour?: number, toHour?: number }} [opts]
 * @returns {Window[]}
 */
export function bestWindows(points, { length = 2, count = 2, fromHour = 6, toHour = 22 } = {}) {
  const awake = (/** @type {HourPoint} */ p) => {
    const h = hourOf(p.time);
    return h >= fromHour && h < toHour;
  };
  const candidates = windowCandidates(points, length, awake).sort((a, b) => a.avg - b.avg || a.i - b.i);
  // Cleanest first: callers treat windows[0] as "the" cleanest window.
  return pickNonOverlapping(candidates, length, count).map(({ i, avg }) => ({
    start: points[i].time,
    end: points[i + length - 1].time,
    avgPm25: Math.round(avg * 10) / 10,
  }));
}

/**
 * Every run of `length` consecutive points that passes `keep`, with its mean.
 * @param {HourPoint[]} points
 * @param {number} length
 * @param {(p: HourPoint) => boolean} keep
 * @returns {{ i: number, avg: number }[]}
 */
function windowCandidates(points, length, keep) {
  /** @type {{ i: number, avg: number }[]} */
  const out = [];
  for (let i = 0; i + length <= points.length; i += 1) {
    const slice = points.slice(i, i + length);
    if (slice.every(keep)) out.push({ i, avg: slice.reduce((sum, p) => sum + p.pm25, 0) / length });
  }
  return out;
}

/**
 * Take candidates in order, skipping any that overlap one already taken.
 * @param {{ i: number, avg: number }[]} ranked
 * @param {number} length
 * @param {number} count
 */
function pickNonOverlapping(ranked, length, count) {
  /** @type {{ i: number, avg: number }[]} */
  const chosen = [];
  for (const c of ranked) {
    if (chosen.length === count) break;
    if (chosen.every((o) => Math.abs(o.i - c.i) >= length)) chosen.push(c);
  }
  return chosen;
}

/**
 * Worst single hour (highest PM2.5) in the points, or null.
 * @param {HourPoint[]} points
 * @returns {HourPoint|null}
 */
export function worstHour(points) {
  if (!points.length) return null;
  return points.reduce((worst, p) => (p.pm25 > worst.pm25 ? p : worst));
}

/**
 * Label for an inclusive range of hourly slots, e.g. 12 PM–2 PM for slots 12:00 and 13:00.
 * @param {string} startIso
 * @param {string} endIso
 */
export function formatRange(startIso, endIso) {
  const end = hourOf(endIso);
  if (Number.isNaN(end)) return formatHour(startIso);
  const next = `T${String((end + 1) % 24).padStart(2, '0')}:00`;
  return `${formatHour(startIso)}–${formatHour(next)}`;
}

/**
 * Format "YYYY-MM-DDTHH:MM" as a "7 AM" style label.
 * @param {string} iso
 */
export function formatHour(iso) {
  const h = hourOf(iso);
  if (Number.isNaN(h)) return '';
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${suffix}`;
}
