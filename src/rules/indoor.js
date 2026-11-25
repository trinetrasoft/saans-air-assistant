// @ts-check
/** Indoor-air rules. */

import { formatHour } from '../forecast.js';

/** @typedef {import('../types.js').Rule} Rule */

/** @type {Rule} */
export function ventilateRule({ window: win, unhealthy }) {
  return {
    id: 'ventilate-smart',
    group: 'indoor',
    priority: unhealthy ? 2 : 4,
    title: win ? `Air out the house only around ${formatHour(win.start)}` : 'Ventilate in short bursts',
    action: 'Open windows for 10–15 minutes during the cleanest window to clear indoor CO₂ and cooking fumes, then close them.',
    impact: 'Short, well-timed ventilation keeps indoor air fresh without letting in the day’s peak smog.',
  };
}

/** @type {Rule} */
export function purifierRule({ profile, unhealthy, sensitive }) {
  if (profile.purifier) {
    return {
      id: 'purifier-use',
      group: 'indoor',
      priority: 3,
      title: 'Run your purifier in the room you sleep in',
      action: 'Keep the door closed, run it on high for the first hour, and replace the filter on schedule.',
      impact: 'Purifiers work best in a closed room; sleeping hours are the longest single block of exposure.',
    };
  }
  if (!unhealthy) return null;
  return {
    id: 'purifier',
    group: 'indoor',
    priority: sensitive ? 1 : 2,
    title: 'Create one clean room with a HEPA purifier',
    action: 'Run a true-HEPA purifier sized for the bedroom (check its CADR) with doors and windows closed. A box fan with a MERV-13 filter strapped on is a low-cost DIY alternative.',
    impact: 'A correctly sized HEPA purifier can substantially reduce indoor fine particles, giving the family at least one place to breathe cleaner air, especially overnight.',
  };
}

/** @type {Rule} */
export function wetCleanRule() {
  return {
    id: 'wet-clean',
    group: 'indoor',
    priority: 4,
    title: 'Wet-mop and damp-dust instead of sweeping',
    action: 'Use a damp cloth and mop. Avoid dry sweeping, incense, mosquito coils and indoor smoking.',
    impact: 'Dry sweeping and smoke sources lift settled particles back into the air you breathe indoors.',
  };
}

/** @type {Rule} */
export function kitchenRule({ profile }) {
  if (profile.cooking === 'biomass') return null; // handled by cleanCookingRule
  return {
    id: 'kitchen',
    group: 'indoor',
    priority: 4,
    title: 'Run the kitchen exhaust while cooking',
    action: 'Switch on the chimney or exhaust fan, and prefer lids and lower-smoke cooking (steaming over deep-frying) on bad days.',
    impact: 'Frying and gas burners release particles and NO₂. Venting them stops indoor levels from stacking on top of outdoor smog.',
  };
}

/** @type {Rule} */
export function plantsMythRule() {
  return {
    id: 'plants-myth',
    group: 'indoor',
    priority: 5,
    title: 'Don’t rely on houseplants to clean the air',
    action: 'Enjoy plants, but use filtration and well-timed ventilation for real particle reduction.',
    impact: 'Plants remove far too little PM2.5 at household scale to make a measurable difference during smog episodes.',
  };
}

export const INDOOR_RULES = Object.freeze([ventilateRule, purifierRule, wetCleanRule, kitchenRule, plantsMythRule]);
