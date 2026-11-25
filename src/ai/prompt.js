// @ts-check
/**
 * Prompt construction: the system instruction, input sanitising and the
 * grounding context built from live data, the profile and vetted actions.
 */

import { AI, INPUT_LIMITS } from '../config.js';
import { formatRange } from '../forecast.js';

/**
 * @typedef {import('../types.js').Profile} Profile
 * @typedef {import('../types.js').CleanWindow} CleanWindow
 * @typedef {{ title: string, impact: string }} GroundingAction
 * @typedef {object} PromptAir
 * @property {string} place
 * @property {number} naqi
 * @property {string} levelLabel
 * @property {'pm25'|'pm10'} dominant
 * @property {Record<string, unknown>} current raw Open-Meteo "current" block
 * @property {CleanWindow[]} windows
 */

export const SYSTEM_INSTRUCTION = [
  'You are Saans, a friendly urban air-quality assistant for families in India.',
  'Use ONLY the context provided (live readings, forecast, household profile and the vetted action list) plus well-established public-health guidance.',
  'Prefer the vetted actions and never contradict them (e.g. LPG and induction are cleaner than wood, dung or coal).',
  'Give short, practical answers (max 120 words) with concrete steps, low-emission routines, indoor air tips and sustainable alternatives.',
  'For every suggestion, say in one clause what difference it makes (the impact).',
  'Never give medical diagnoses; for symptoms like breathlessness or chest pain, advise contacting a doctor.',
  'If the question is unrelated to air quality, health or sustainability, politely steer back.',
].join(' ');

// Control characters except tab, newline and carriage return.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Strip control characters and clamp the length of user input.
 * @param {unknown} q
 * @returns {string}
 */
export function sanitizeQuestion(q) {
  return String(q ?? '').replace(CONTROL_CHARS, '').trim().slice(0, INPUT_LIMITS.questionMax);
}

/**
 * Round a reading for display, or "n/a".
 * @param {unknown} v
 */
function reading(v) {
  return typeof v === 'number' && Number.isFinite(v) ? String(Math.round(v)) : 'n/a';
}

/** @param {Profile} p */
function describeHousehold(p) {
  const members = [p.children && 'children', p.elderly && 'elderly', p.respiratory && 'asthma/respiratory condition']
    .filter(Boolean).join(', ') || 'no sensitive members';
  return `Household: ${members}; commute: ${p.commute}; cooking: ${p.cooking}; purifier: ${p.purifier ? 'yes' : 'no'}; heating: ${p.heating}`;
}

/**
 * Build the grounding context passed to the model.
 * @param {PromptAir} air
 * @param {Profile} profile normalised profile
 * @param {GroundingAction[]} [actions] vetted actions from the advisor, highest priority first
 * @returns {string}
 */
export function buildContext(air, profile, actions = []) {
  const windows = (air.windows ?? []).map((w) => `${formatRange(w.start, w.end)} (~${w.avgPm25} µg/m³)`).join('; ');
  const vetted = actions.slice(0, AI.groundingActions).map((a) => `${a.title} (${a.impact})`).join(' | ');
  const c = air.current;
  return [
    `Location: ${air.place}`,
    `India NAQI (PM-based estimate): ${air.naqi} (${air.levelLabel}), dominant pollutant ${air.dominant === 'pm10' ? 'PM10' : 'PM2.5'}`,
    `Now: PM2.5 ${reading(c.pm2_5)} µg/m³, PM10 ${reading(c.pm10)}, NO2 ${reading(c.nitrogen_dioxide)}, O3 ${reading(c.ozone)}`,
    `Cleanest upcoming windows: ${windows || 'not available'}`,
    describeHousehold(profile),
    `Vetted actions: ${vetted || 'none'}`,
  ].join('\n');
}

/**
 * Compose the full prompt for a question.
 * @param {string} context
 * @param {string} question
 */
export function buildPrompt(context, question) {
  return `Context:\n${context}\n\nQuestion: ${sanitizeQuestion(question)}`;
}
