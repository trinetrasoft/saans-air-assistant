// @ts-check
/**
 * Deterministic recommendation engine.
 *
 * The advisor builds a small, pre-computed {@link RuleContext} and runs it
 * through independent rules (one function per piece of advice, grouped by
 * theme in `src/rules/`). Each rule returns one explainable recommendation or
 * null; the advisor then ranks them. Adding advice means adding a rule, with
 * no changes to this file.
 */

import { category } from './aqi.js';
import { THRESHOLDS } from './config.js';
import { outingComparison } from './impact.js';
import { normaliseProfile, isSensitive } from './profile.js';
import { HEALTH_RULES } from './rules/health.js';
import { ROUTINE_RULES } from './rules/routine.js';
import { INDOOR_RULES } from './rules/indoor.js';
import { SUSTAINABLE_RULES } from './rules/sustainable.js';

export { normaliseProfile, isSensitive, DEFAULT_PROFILE } from './profile.js';

/**
 * @typedef {import('./types.js').AirSituation} AirSituation
 * @typedef {import('./types.js').Rec} Rec
 * @typedef {import('./types.js').Rule} Rule
 * @typedef {import('./types.js').RuleContext} RuleContext
 */

/** All rules, in no particular order (output is sorted by priority). */
export const RULES = Object.freeze([...HEALTH_RULES, ...ROUTINE_RULES, ...INDOOR_RULES, ...SUSTAINABLE_RULES]);

/**
 * Pre-compute the facts every rule needs.
 * @param {AirSituation} air
 * @param {Record<string, unknown>} rawProfile
 * @returns {RuleContext}
 */
export function buildRuleContext(air, rawProfile) {
  const profile = normaliseProfile(rawProfile);
  const window = air.windows?.[0];
  const outing = Number.isFinite(air.pm25)
    ? outingComparison({ nowPm25: Number(air.pm25), windowPm25: window?.avgPm25 ?? null })
    : null;
  return {
    air,
    profile,
    sensitive: isSensitive(profile),
    unhealthy: air.naqi > THRESHOLDS.unhealthy,
    hazardous: air.naqi > THRESHOLDS.hazardous,
    window,
    outing,
  };
}

/**
 * Most urgent first; ties broken by id so output is stable.
 * @param {Rec} a
 * @param {Rec} b
 */
export function byPriority(a, b) {
  return a.priority - b.priority || a.id.localeCompare(b.id);
}

/**
 * @param {AirSituation} air
 * @param {Record<string, unknown>} rawProfile
 * @param {readonly Rule[]} [rules]
 * @returns {{ level: ReturnType<typeof category>, sensitive: boolean, recs: Rec[] }}
 */
export function advise(air, rawProfile, rules = RULES) {
  const ctx = buildRuleContext(air, rawProfile);
  const recs = rules
    .map((rule) => rule(ctx))
    .filter(/** @returns {r is Rec} */ (r) => r !== null)
    .sort(byPriority);
  return { level: category(air.naqi), sensitive: ctx.sensitive, recs };
}
