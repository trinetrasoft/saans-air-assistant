// @ts-check
/** Health-protection rules. */

import { THRESHOLDS } from '../config.js';
import { sensitiveMembers } from '../profile.js';

/** @typedef {import('../types.js').Rule} Rule */

/** @type {Rule} */
export function maskRule({ unhealthy, hazardous, sensitive, outing }) {
  if (!unhealthy) return null;
  return {
    id: 'mask',
    group: 'health',
    priority: hazardous || sensitive ? 1 : 2,
    title: 'Wear a well-fitted N95/FFP2 outdoors',
    action: 'Use a certified N95 or FFP2 respirator that seals around the nose; cloth and surgical masks do not stop fine particles.',
    impact: outing
      ? `A one-hour walk right now means inhaling about ${outing.now} µg of PM2.5; a well-fitted N95 (rated ≥95% filtration) can cut that to about ${outing.withMask} µg.`
      : 'N95 respirators are rated to filter at least 95% of fine airborne particles when fitted properly, sharply cutting the PM2.5 you inhale on the street.',
  };
}

/** @type {Rule} */
export function sensitiveIndoorsRule({ unhealthy, sensitive, profile }) {
  if (!unhealthy || !sensitive) return null;
  return {
    id: 'sensitive-indoors',
    group: 'health',
    priority: 1,
    title: 'Keep sensitive family members indoors during peaks',
    action: `Move play, walks and exercise for ${sensitiveMembers(profile)} indoors, and keep reliever medication handy.`,
    impact: 'Sensitive groups react to lower pollution levels; avoiding the worst hours reduces flare-ups and emergency visits.',
  };
}

/** @type {Rule} */
export function noExerciseRule({ hazardous }) {
  if (!hazardous) return null;
  return {
    id: 'no-exercise',
    group: 'health',
    priority: 1,
    title: 'Skip outdoor exercise today',
    action: `Swap runs and outdoor sport for indoor workouts or yoga until the index drops below ${THRESHOLDS.exerciseSafe}.`,
    impact: 'Heavy breathing during exercise multiplies the volume of polluted air drawn deep into the lungs.',
  };
}

export const HEALTH_RULES = Object.freeze([maskRule, sensitiveIndoorsRule, noExerciseRule]);
