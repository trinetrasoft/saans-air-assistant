// @ts-check
/**
 * Generative-AI orchestration for "Ask Saans".
 *
 * Providers are tried in order (see `./ai/providers.js`):
 *  1. on-device Gemini Nano, when already installed;
 *  2. the Gemini API, when the user supplied a key;
 *  3. the deterministic fallback, so the feature never fails.
 * Every model call is bounded by a timeout.
 */

import { AI, INPUT_LIMITS } from './config.js';
import { buildPrompt } from './ai/prompt.js';
import { onDeviceAvailable, askOnDevice, askGemini, fallbackAnswer } from './ai/providers.js';

export { SYSTEM_INSTRUCTION, sanitizeQuestion, buildContext, buildPrompt } from './ai/prompt.js';
export { onDeviceAvailable, askGemini, fallbackAnswer } from './ai/providers.js';
/** Maximum accepted question length (characters). */
export const MAX_QUESTION_CHARS = INPUT_LIMITS.questionMax;

/** @typedef {'on-device'|'gemini'|'rules'} Provider */

/**
 * Reject if `promise` does not settle within `ms`.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} [ms]
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms = AI.timeoutMs) {
  /** @type {ReturnType<typeof setTimeout>|undefined} */
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Model timed out')), ms);
  });
  return /** @type {Promise<T>} */ (Promise.race([promise, timeout])).finally(() => clearTimeout(timer));
}

/**
 * @typedef {object} AskOptions
 * @property {string} question
 * @property {string} context grounding context from `buildContext`
 * @property {{ title: string, action: string, impact: string, group: string }[]} recs vetted actions
 * @property {string} [apiKey] optional Gemini API key
 * @property {string} [model]
 * @property {typeof fetch} [fetchImpl]
 * @property {any} [globalObj] where to look for Chrome's `LanguageModel`
 * @property {number} [timeoutMs]
 *
 * @typedef {object} Answer
 * @property {string} text
 * @property {Provider} provider which provider answered
 * @property {string[]} fallbacks reasons earlier providers were skipped (shown to the user)
 */

/**
 * Ask a question using the best available provider. Failures are not
 * swallowed silently: each one is recorded in `fallbacks`.
 * @param {AskOptions} opts
 * @returns {Promise<Answer>}
 */
export async function ask({
  question, context, recs, apiKey, model, fetchImpl = fetch, globalObj = globalThis, timeoutMs = AI.timeoutMs,
}) {
  const prompt = buildPrompt(context, question);
  /** @type {string[]} */
  const fallbacks = [];
  if (await onDeviceAvailable(globalObj)) {
    try {
      const text = await withTimeout(askOnDevice(prompt, globalObj), timeoutMs);
      return { text, provider: 'on-device', fallbacks };
    } catch (err) {
      fallbacks.push(`On-device AI unavailable: ${errorMessage(err)}`);
    }
  }
  if (apiKey) {
    try {
      const text = await withTimeout(askGemini(prompt, apiKey, { model, fetchImpl }), timeoutMs);
      return { text, provider: 'gemini', fallbacks };
    } catch (err) {
      fallbacks.push(`Gemini API unavailable: ${errorMessage(err)}`);
    }
  }
  return { text: fallbackAnswer(question, recs), provider: 'rules', fallbacks };
}

/**
 * @param {unknown} err
 * @returns {string}
 */
function errorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}
