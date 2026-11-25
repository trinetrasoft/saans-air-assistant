// @ts-check
/**
 * Answer providers. Each takes a finished prompt and returns text or throws.
 *  - on-device: Chrome's built-in Gemini Nano (Prompt API). Private and free.
 *  - gemini: Google Gemini API with the user's own key, held in memory only and
 *    sent only in the `x-goog-api-key` header.
 *  - rules: deterministic answer from the advisor's vetted actions.
 */

import { AI, ENDPOINTS } from '../config.js';
import { SYSTEM_INSTRUCTION, sanitizeQuestion } from './prompt.js';

/** Declared languages for Chrome's Prompt API (needed for quality and safety checks). */
const LM_OPTIONS = Object.freeze({
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
});

const MODEL_NAME = /^[a-z0-9.-]+$/i;
const MIN_KEYWORD_LENGTH = 3;
const FALLBACK_ACTIONS = 2;

/**
 * True only when the on-device model is already installed. 'downloadable' or
 * 'downloading' would make the user wait for a multi-gigabyte download.
 * @param {any} [globalObj]
 */
export async function onDeviceAvailable(globalObj = globalThis) {
  try {
    const LM = globalObj.LanguageModel;
    if (!LM || typeof LM.availability !== 'function') return false;
    return (await LM.availability(LM_OPTIONS)) === 'available';
  } catch {
    return false;
  }
}

/**
 * @param {string} prompt
 * @param {any} globalObj
 * @returns {Promise<string>}
 */
export async function askOnDevice(prompt, globalObj = globalThis) {
  const session = await globalObj.LanguageModel.create({
    ...LM_OPTIONS,
    initialPrompts: [{ role: 'system', content: SYSTEM_INSTRUCTION }],
  });
  try {
    return await session.prompt(prompt);
  } finally {
    session.destroy?.();
  }
}

/**
 * Request body for Gemini's generateContent.
 * @param {string} prompt
 */
export function geminiBody(prompt) {
  return {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: AI.temperature, maxOutputTokens: AI.maxOutputTokens },
  };
}

/**
 * Concatenated text of the first candidate, or '' if absent.
 * @param {any} data generateContent response
 * @returns {string}
 */
export function geminiText(data) {
  /** @type {{ text?: string }[]} */
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? '').join('').trim();
}

/**
 * Gemini API call (bring-your-own-key).
 * @param {string} prompt
 * @param {string} apiKey
 * @param {{ model?: string, fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<string>}
 */
export async function askGemini(prompt, apiKey, { model = AI.defaultModel, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error('Missing API key');
  const safeModel = MODEL_NAME.test(model) ? model : AI.defaultModel;
  const res = await fetchImpl(`${ENDPOINTS.gemini}/${safeModel}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(geminiBody(prompt)),
  });
  if (!res.ok) throw new Error(`Gemini request failed (${res.status})`);
  const text = geminiText(await res.json());
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

/**
 * Rule-based answer used when no model is available: the vetted actions most
 * relevant to the question, ranked by keyword overlap then priority order.
 * @param {string} question
 * @param {{ title: string, action: string, impact: string, group: string }[]} recs
 * @returns {string}
 */
export function fallbackAnswer(question, recs) {
  const words = sanitizeQuestion(question).toLowerCase().split(/[^a-z0-9]+/)
    .filter((w) => w.length >= MIN_KEYWORD_LENGTH);
  const top = recs
    .map((r, index) => {
      const haystack = `${r.title} ${r.action} ${r.group}`.toLowerCase();
      return { r, index, score: words.filter((w) => haystack.includes(w)).length };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, FALLBACK_ACTIONS)
    .map(({ r }) => `${r.title}: ${r.action} Why: ${r.impact}`);
  return `Here is what matters most right now. ${top.join(' ')}`;
}
