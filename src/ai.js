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
 * Ask a question using the best available provider.
 * @param {{ question: string, context: string, recs: { title: string, action: string, impact: string, group: string }[],
 *   apiKey?: string, model?: string, fetchImpl?: typeof fetch, globalObj?: any, timeoutMs?: number }} opts
 * @returns {Promise<{ text: string, provider: Provider }>}
 */
export async function ask({
  question, context, recs, apiKey, model, fetchImpl = fetch, globalObj = globalThis, timeoutMs = AI.timeoutMs,
}) {
  const prompt = buildPrompt(context, question);
  if (await onDeviceAvailable(globalObj)) {
    try {
      return { text: await withTimeout(askOnDevice(prompt, globalObj), timeoutMs), provider: 'on-device' };
    } catch { /* fall through to the next provider */ }
  }
  if (apiKey) {
    try {
      return { text: await withTimeout(askGemini(prompt, apiKey, { model, fetchImpl }), timeoutMs), provider: 'gemini' };
    } catch { /* fall through to the deterministic answer */ }
  }
  return { text: fallbackAnswer(question, recs), provider: 'rules' };
}
