// @ts-check
/** Sustainable-alternative rules: choices that cut emissions at the source. */

/** @typedef {import('../types.js').Rule} Rule */

/** @type {Readonly<Partial<Record<import('../types.js').Commute, string>>>} */
const COMMUTE_ACTION = Object.freeze({
  car: 'Carpool, use public transport, or work from home on Poor-or-worse days. In the car, keep windows up and set the AC to recirculate.',
  'two-wheeler': 'Two-wheeler riders breathe traffic exhaust directly. Prefer metro or bus, or ride outside rush hour with an N95.',
});

/** @type {Rule} */
export function commuteShiftRule({ profile, unhealthy }) {
  const action = COMMUTE_ACTION[profile.commute];
  if (!action) return null;
  return {
    id: 'commute-shift',
    group: 'sustainable',
    priority: unhealthy ? 2 : 3,
    title: 'Share the ride or switch to metro/bus on smoggy days',
    action,
    impact: 'Each private vehicle kept off the road removes tailpipe NO₂ and particles at street level, where everyone breathes, and cuts your own in-traffic exposure.',
  };
}

/** @type {Rule} */
export function cleanCookingRule({ profile }) {
  if (profile.cooking !== 'biomass') return null;
  return {
    id: 'clean-cooking',
    group: 'sustainable',
    priority: 1,
    title: 'Move cooking off wood or dung to LPG or induction',
    action: 'If a switch is not possible yet, cook with the window open and use an exhaust fan or chimney hood.',
    impact: 'Solid-fuel cooking is one of the largest sources of household air pollution, and the cook and young children receive the highest doses.',
  };
}

/** @type {Rule} */
export function cleanHeatingRule({ profile }) {
  if (profile.heating !== 'wood-coal') return null;
  return {
    id: 'heating',
    group: 'sustainable',
    priority: 1,
    title: 'Replace wood/coal heating with an electric heater',
    action: 'Use an oil-filled or fan heater for the room in use, and never burn rubbish, leaves or plastic for warmth.',
    impact: 'Open burning and solid-fuel heaters add smoke indoors and to the whole neighbourhood, which is a major contributor to winter smog.',
  };
}

/** @type {Rule} */
export function noBurningRule({ hazardous }) {
  return {
    id: 'no-burning',
    group: 'sustainable',
    priority: hazardous ? 2 : 4,
    title: 'Never burn leaves or waste, and report open fires',
    action: 'Compost garden waste, segregate dry waste for collection, and report open burning to your municipal helpline or the CPCB Sameer app.',
    impact: 'Open burning produces dense smoke at ground level. Stopping it is one of the fastest community-level wins in winter.',
  };
}

export const SUSTAINABLE_RULES = Object.freeze([commuteShiftRule, cleanCookingRule, cleanHeatingRule, noBurningRule]);
