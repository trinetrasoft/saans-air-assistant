// @ts-check
/**
 * Shared JSDoc type definitions. This module has no runtime code; import it
 * in JSDoc only, e.g. `@param {import('./types.js').Profile} p`.
 */

/** @typedef {'car'|'two-wheeler'|'public'|'walk-cycle'|'wfh'} Commute */
/** @typedef {'lpg'|'electric'|'biomass'} CookingFuel */
/** @typedef {'none'|'electric'|'wood-coal'} Heating */

/**
 * Household profile, always normalised by `normaliseProfile` before use.
 * @typedef {object} Profile
 * @property {boolean} children
 * @property {boolean} elderly
 * @property {boolean} respiratory
 * @property {Commute} commute
 * @property {CookingFuel} cooking
 * @property {boolean} purifier
 * @property {Heating} heating
 */

/** @typedef {'health'|'routine'|'indoor'|'sustainable'} RecGroup */

/**
 * One explainable recommendation.
 * @typedef {object} Rec
 * @property {string} id stable identifier
 * @property {RecGroup} group
 * @property {string} title
 * @property {string} action what to do
 * @property {string} impact why it matters (quantified when data allows)
 * @property {number} priority 1 = most urgent
 */

/** @typedef {{ time: string, pm25: number }} HourPoint */
/** @typedef {{ start: string, end: string, avgPm25: number }} CleanWindow */

/**
 * Air-quality situation passed to the advisor.
 * @typedef {object} AirSituation
 * @property {number} naqi India NAQI value
 * @property {number} [pm25] current PM2.5 in µg/m³
 * @property {number} [lat]
 * @property {number} [lon]
 * @property {CleanWindow[]} [windows] cleanest upcoming windows, best first
 * @property {HourPoint|null} [worst] worst upcoming hour
 */

/**
 * Pre-computed facts each advisor rule reads.
 * @typedef {object} RuleContext
 * @property {AirSituation} air
 * @property {Profile} profile
 * @property {boolean} sensitive household includes a sensitive group
 * @property {boolean} unhealthy index is Moderate or worse
 * @property {boolean} hazardous index is Very Poor or worse
 * @property {CleanWindow|undefined} window cleanest window
 * @property {ReturnType<typeof import('./impact.js').outingComparison>|null} outing
 */

/**
 * A rule maps the context to zero or one recommendation.
 * @typedef {(ctx: RuleContext) => Rec|null} Rule
 */

export {};
