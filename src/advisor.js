/**
 * Deterministic recommendation engine. Given the air-quality situation and a
 * household profile, it produces ranked, explainable actions in four groups:
 * health protection, daily routine, indoor air and sustainable alternatives.
 * Every recommendation carries an "impact" sentence that explains *why* it
 * matters, so the advice is transparent even without a language model.
 */

import { category } from './aqi.js';
import { formatHour, formatRange } from './forecast.js';

/**
 * @typedef {'car'|'two-wheeler'|'public'|'walk-cycle'|'wfh'} Commute
 * @typedef {{
 *   children?: boolean, elderly?: boolean, respiratory?: boolean,
 *   commute?: Commute, cooking?: 'lpg'|'electric'|'biomass',
 *   purifier?: boolean, heating?: 'none'|'electric'|'wood-coal',
 * }} Profile
 * @typedef {{ id: string, group: 'health'|'routine'|'indoor'|'sustainable',
 *   title: string, action: string, impact: string, priority: number }} Rec
 */

export const DEFAULT_PROFILE = Object.freeze({
  children: false, elderly: false, respiratory: false,
  commute: 'public', cooking: 'lpg', purifier: false, heating: 'none',
});

/** Sanitise an untrusted profile object into the known shape. */
export function normaliseProfile(input = {}) {
  const pick = (v, allowed, d) => (allowed.includes(v) ? v : d);
  return {
    children: input.children === true,
    elderly: input.elderly === true,
    respiratory: input.respiratory === true,
    commute: pick(input.commute, ['car', 'two-wheeler', 'public', 'walk-cycle', 'wfh'], DEFAULT_PROFILE.commute),
    cooking: pick(input.cooking, ['lpg', 'electric', 'biomass'], DEFAULT_PROFILE.cooking),
    purifier: input.purifier === true,
    heating: pick(input.heating, ['none', 'electric', 'wood-coal'], DEFAULT_PROFILE.heating),
  };
}

/** True when anyone in the household is in a sensitive group. */
export function isSensitive(p) {
  return Boolean(p.children || p.elderly || p.respiratory);
}

/**
 * @param {{ naqi: number, windows?: {start:string,end:string,avgPm25:number}[], worst?: {time:string,pm25:number}|null }} air
 * @param {Profile} rawProfile
 * @returns {{ level: ReturnType<typeof category>, sensitive: boolean, recs: Rec[] }}
 */
export function advise(air, rawProfile) {
  const p = normaliseProfile(rawProfile);
  const level = category(air.naqi);
  const sensitive = isSensitive(p);
  const bad = air.naqi > 100; // Moderate or worse
  const veryBad = air.naqi > 300; // Very Poor or worse
  /** @type {Rec[]} */
  const recs = [];
  const add = (r) => recs.push(r);

  // --- Health protection -------------------------------------------------
  if (bad) {
    add({
      id: 'mask', group: 'health', priority: veryBad || sensitive ? 1 : 2,
      title: 'Wear a well-fitted N95/FFP2 outdoors',
      action: 'Use a certified N95 or FFP2 respirator that seals around the nose; cloth and surgical masks do not stop fine particles.',
      impact: 'N95 respirators are rated to filter at least 95% of fine airborne particles when fitted properly, sharply cutting the PM2.5 you inhale on the street.',
    });
  }
  if (bad && sensitive) {
    const who = [p.children && 'children', p.elderly && 'older adults', p.respiratory && 'anyone with asthma or lung/heart conditions']
      .filter(Boolean).join(', ');
    add({
      id: 'sensitive-indoors', group: 'health', priority: 1,
      title: 'Keep sensitive family members indoors during peaks',
      action: `Move play, walks and exercise for ${who} indoors, and keep reliever medication handy.`,
      impact: 'Sensitive groups react to lower pollution levels; avoiding the worst hours reduces flare-ups and emergency visits.',
    });
  }
  if (veryBad) {
    add({
      id: 'no-exercise', group: 'health', priority: 1,
      title: 'Skip outdoor exercise today',
      action: 'Swap runs and outdoor sport for indoor workouts or yoga until the index drops below 200.',
      impact: 'Heavy breathing during exercise multiplies the volume of polluted air drawn deep into the lungs.',
    });
  }

  // --- Daily routine -----------------------------------------------------
  const win = air.windows?.[0];
  if (win) {
    add({
      id: 'best-window', group: 'routine', priority: bad ? 1 : 3,
      title: `Plan outdoor tasks for ${formatRange(win.start, win.end)}`,
      action: `The forecast's cleanest stretch today averages about ${win.avgPm25} µg/m³ PM2.5. Schedule errands, school runs or walks then.`,
      impact: 'Shifting the same activity into the cleanest hours lowers your exposure without changing what you do.',
    });
  }
  if (air.worst && bad) {
    add({
      id: 'avoid-peak', group: 'routine', priority: 2,
      title: `Avoid being outside around ${formatHour(air.worst.time)}`,
      action: 'This is the forecast peak. Keep windows shut and postpone non-essential trips.',
      impact: `PM2.5 is expected to reach about ${Math.round(air.worst.pm25)} µg/m³ then, the worst hour of the day.`,
    });
  }
  if (p.commute === 'car' || p.commute === 'two-wheeler') {
    add({
      id: 'commute-shift', group: 'sustainable', priority: bad ? 2 : 3,
      title: 'Share the ride or switch to metro/bus on smoggy days',
      action: p.commute === 'car'
        ? 'Carpool, use public transport, or work from home on Poor-or-worse days. In the car, keep windows up and set the AC to recirculate.'
        : 'Two-wheeler riders breathe traffic exhaust directly. Prefer metro or bus, or ride outside rush hour with an N95.',
      impact: 'Each private vehicle kept off the road removes tailpipe NO₂ and particles at street level, where everyone breathes, and cuts your own in-traffic exposure.',
    });
  }
  if (p.commute === 'walk-cycle' && bad) {
    add({
      id: 'route', group: 'routine', priority: 2,
      title: 'Take quieter streets and parks, away from main roads',
      action: 'Even one block away from heavy traffic usually means cleaner air. Avoid idling junctions.',
      impact: 'Pollution from traffic falls off quickly with distance from busy roads, so the route matters as much as the time.',
    });
  }

  // --- Indoor air --------------------------------------------------------
  add({
    id: 'ventilate-smart', group: 'indoor', priority: bad ? 2 : 4,
    title: win ? `Air out the house only around ${formatHour(win.start)}` : 'Ventilate in short bursts',
    action: 'Open windows for 10–15 minutes during the cleanest window to clear indoor CO₂ and cooking fumes, then close them.',
    impact: 'Short, well-timed ventilation keeps indoor air fresh without letting in the day’s peak smog.',
  });
  if (!p.purifier && bad) {
    add({
      id: 'purifier', group: 'indoor', priority: sensitive ? 1 : 2,
      title: 'Create one clean room with a HEPA purifier',
      action: 'Run a true-HEPA purifier sized for the bedroom (check its CADR) with doors and windows closed. A box fan with a MERV-13 filter strapped on is a low-cost DIY alternative.',
      impact: 'A correctly sized HEPA purifier can substantially reduce indoor fine particles, giving the family at least one place to breathe cleaner air, especially overnight.',
    });
  } else if (p.purifier) {
    add({
      id: 'purifier-use', group: 'indoor', priority: 3,
      title: 'Run your purifier in the room you sleep in',
      action: 'Keep the door closed, run it on high for the first hour, and replace the filter on schedule.',
      impact: 'Purifiers work best in a closed room; sleeping hours are the longest single block of exposure.',
    });
  }
  add({
    id: 'wet-clean', group: 'indoor', priority: 4,
    title: 'Wet-mop and damp-dust instead of sweeping',
    action: 'Use a damp cloth and mop. Avoid dry sweeping, incense, mosquito coils and indoor smoking.',
    impact: 'Dry sweeping and smoke sources lift settled particles back into the air you breathe indoors.',
  });
  if (p.cooking === 'biomass') {
    add({
      id: 'clean-cooking', group: 'sustainable', priority: 1,
      title: 'Move cooking off wood or dung to LPG or induction',
      action: 'If a switch is not possible yet, cook with the window open and use an exhaust fan or chimney hood.',
      impact: 'Solid-fuel cooking is one of the largest sources of household air pollution, and the cook and young children receive the highest doses.',
    });
  } else {
    add({
      id: 'kitchen', group: 'indoor', priority: 4,
      title: 'Run the kitchen exhaust while cooking',
      action: 'Switch on the chimney or exhaust fan, and prefer lids and lower-smoke cooking (steaming over deep-frying) on bad days.',
      impact: 'Frying and gas burners release particles and NO₂. Venting them stops indoor levels from stacking on top of outdoor smog.',
    });
  }
  if (p.heating === 'wood-coal') {
    add({
      id: 'heating', group: 'sustainable', priority: 1,
      title: 'Replace wood/coal heating with an electric heater',
      action: 'Use an oil-filled or fan heater for the room in use, and never burn rubbish, leaves or plastic for warmth.',
      impact: 'Open burning and solid-fuel heaters add smoke indoors and to the whole neighbourhood, which is a major contributor to winter smog.',
    });
  }
  add({
    id: 'no-burning', group: 'sustainable', priority: veryBad ? 2 : 4,
    title: 'Never burn leaves or waste, and report open fires',
    action: 'Compost garden waste, segregate dry waste for collection, and report open burning to your municipal helpline or the CPCB Sameer app.',
    impact: 'Open burning produces dense smoke at ground level. Stopping it is one of the fastest community-level wins in winter.',
  });
  add({
    id: 'plants-myth', group: 'indoor', priority: 5,
    title: 'Don’t rely on houseplants to clean the air',
    action: 'Enjoy plants, but use filtration and well-timed ventilation for real particle reduction.',
    impact: 'Plants remove far too little PM2.5 at household scale to make a measurable difference during smog episodes.',
  });

  recs.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  return { level, sensitive, recs };
}
