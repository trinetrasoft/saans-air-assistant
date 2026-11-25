// @ts-check
/**
 * Central configuration: every tunable number and external endpoint lives
 * here instead of being scattered through the code as magic values.
 */

export const ENDPOINTS = Object.freeze({
  geocoding: 'https://geocoding-api.open-meteo.com/v1/search',
  airQuality: 'https://air-quality-api.open-meteo.com/v1/air-quality',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
});

export const NETWORK = Object.freeze({
  /** Abort Open-Meteo requests after this long. */
  timeoutMs: 10_000,
  /** Reuse identical responses for this long. */
  cacheTtlMs: 10 * 60 * 1000,
  /** Cap on cached responses to bound memory. */
  cacheMaxEntries: 50,
  forecastDays: 2,
  maxPlaces: 5,
});

export const INPUT_LIMITS = Object.freeze({
  placeQueryMin: 2,
  placeQueryMax: 80,
  questionMax: 500,
});

export const AI = Object.freeze({
  defaultModel: 'gemini-flash-latest',
  /** First on-device runs can take ~20 s while the model loads. */
  timeoutMs: 60_000,
  temperature: 0.4,
  maxOutputTokens: 400,
  /** How many vetted actions are passed to the model as grounding. */
  groundingActions: 6,
});

export const FORECAST = Object.freeze({
  horizonHours: 24,
  windowHours: 2,
  windowCount: 2,
  /** Waking hours considered for outdoor plans: [from, to). */
  fromHour: 6,
  toHour: 22,
});

/** NAQI thresholds used by the advisor. */
export const THRESHOLDS = Object.freeze({
  /** Above this the air is Moderate or worse. */
  unhealthy: 100,
  /** Above this the air is Very Poor or worse. */
  hazardous: 300,
  /** Resume outdoor exercise once the index falls below this. */
  exerciseSafe: 200,
});

export const STORAGE_KEYS = Object.freeze({
  profile: 'saans.profile.v1',
});
