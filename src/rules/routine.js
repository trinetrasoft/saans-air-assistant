// @ts-check
/** Daily-routine rules: when and where to be outside. */

import { formatHour, formatRange } from '../forecast.js';
import { inDelhiNcr, grapStage } from '../impact.js';

/** @typedef {import('../types.js').Rule} Rule */

/** @type {Rule} */
export function bestWindowRule({ window: win, unhealthy, outing }) {
  if (!win) return null;
  const quantified = outing && outing.windowSaving > 0;
  return {
    id: 'best-window',
    group: 'routine',
    priority: unhealthy ? 1 : 3,
    title: `Plan outdoor tasks for ${formatRange(win.start, win.end)}`,
    action: `The forecast's cleanest stretch today averages about ${win.avgPm25} µg/m³ PM2.5. Schedule errands, school runs or walks then.`,
    impact: quantified
      ? `Doing a one-hour errand then instead of now cuts the PM2.5 you inhale from about ${outing.now} µg to ${outing.inWindow} µg, ${outing.windowSaving}% less, without changing what you do.`
      : 'Shifting the same activity into the cleanest hours lowers your exposure without changing what you do.',
  };
}

/** @type {Rule} */
export function avoidPeakRule({ air, unhealthy }) {
  if (!air.worst || !unhealthy) return null;
  return {
    id: 'avoid-peak',
    group: 'routine',
    priority: 2,
    title: `Avoid being outside around ${formatHour(air.worst.time)}`,
    action: 'This is the forecast peak. Keep windows shut and postpone non-essential trips.',
    impact: `PM2.5 is expected to reach about ${Math.round(air.worst.pm25)} µg/m³ then, the worst hour of the day.`,
  };
}

/** @type {Rule} */
export function quietRouteRule({ profile, unhealthy }) {
  if (profile.commute !== 'walk-cycle' || !unhealthy) return null;
  return {
    id: 'route',
    group: 'routine',
    priority: 2,
    title: 'Take quieter streets and parks, away from main roads',
    action: 'Even one block away from heavy traffic usually means cleaner air. Avoid idling junctions.',
    impact: 'Pollution from traffic falls off quickly with distance from busy roads, so the route matters as much as the time.',
  };
}

/** @type {Rule} */
export function grapRule({ air }) {
  const located = Number.isFinite(air.lat) && Number.isFinite(air.lon);
  const grap = located && inDelhiNcr(Number(air.lat), Number(air.lon)) ? grapStage(air.naqi) : null;
  if (!grap) return null;
  return {
    id: 'grap',
    group: 'routine',
    priority: 2,
    title: `Delhi-NCR: GRAP Stage ${grap.stage} conditions`,
    action: `At this level CAQM's Graded Response Action Plan typically triggers ${grap.measures} Check the latest CAQM order before you travel.`,
    impact: 'Following the stage rules (and planning around them) keeps your trips legal and avoids adding to emissions on the days the region needs it most.',
  };
}

export const ROUTINE_RULES = Object.freeze([bestWindowRule, avoidPeakRule, quietRouteRule, grapRule]);
