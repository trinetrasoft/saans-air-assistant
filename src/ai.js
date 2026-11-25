/**
 * Generative-AI layer for "Ask Saans".
 *
 * Providers, tried in order:
 *  1. Chrome's built-in on-device model (Gemini Nano via the Prompt API).
 *     Private and free; data never leaves the device.
 *  2. Google Gemini API with the user's own key (bring-your-own-key). The key
 *     is held in memory only unless the user opts to keep it for this tab
 *     (sessionStorage); it is never written to the page or sent anywhere except
 *     generativelanguage.googleapis.com.
 *  3. A grounded rule-based fallback, so the app still answers helpfully offline.
 *
 * Every prompt is grounded in live data (NAQI, pollutants, forecast windows)
 * plus the household profile, and the model is told to stay on topic.
 */

import { formatRange } from './forecast.js';

export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
export const DEFAULT_MODEL = 'gemini-flash-latest';
export const MAX_QUESTION_CHARS = 500;
export const MODEL_TIMEOUT_MS = 25000;

/** Reject if `promise` does not settle within `ms`. */
export function withTimeout(promise, ms = MODEL_TIMEOUT_MS) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Model timed out')), ms); }),
  ]).finally(() => clearTimeout(timer));
}
/** Declared languages for Chrome's Prompt API (required for quality and safety checks). */
const LM_OPTIONS = Object.freeze({
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
});

export const SYSTEM_INSTRUCTION = [
  'You are Saans, a friendly urban air-quality assistant for families in India.',
  'Use ONLY the context provided (live readings, forecast and household profile) plus well-established public-health guidance.',
  'Give short, practical answers (max 120 words) with concrete steps, low-emission routines, indoor air tips and sustainable alternatives.',
  'For every suggestion, say in one clause what difference it makes (the impact).',
  'Never give medical diagnoses; for symptoms like breathlessness or chest pain, advise contacting a doctor.',
  'If the question is unrelated to air quality, health or sustainability, politely steer back.',
].join(' ');

/** Strip control characters and clamp length of user input. */
export function sanitizeQuestion(q) {
  return String(q ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, MAX_QUESTION_CHARS);
}

/**
 * Build the grounding context passed to the model.
 * @param {{ place: string, naqi: number, levelLabel: string, dominant: string,
 *   current: Record<string, unknown>, windows: {start:string,end:string,avgPm25:number}[] }} air
 * @param {Record<string, unknown>} profile normalised profile
 */
export function buildContext(air, profile) {
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 'n/a');
  const windows = (air.windows ?? [])
    .map((w) => `${formatRange(w.start, w.end)} (~${w.avgPm25} µg/m³)`)
    .join('; ') || 'not available';
  const household = [
    profile.children && 'children', profile.elderly && 'elderly',
    profile.respiratory && 'asthma/respiratory condition',
  ].filter(Boolean).join(', ') || 'no sensitive members';
  return [
    `Location: ${air.place}`,
    `India NAQI (PM-based estimate): ${air.naqi} (${air.levelLabel}), dominant pollutant ${air.dominant === 'pm10' ? 'PM10' : 'PM2.5'}`,
    `Now: PM2.5 ${num(air.current.pm2_5)} µg/m³, PM10 ${num(air.current.pm10)}, NO2 ${num(air.current.nitrogen_dioxide)}, O3 ${num(air.current.ozone)}`,
    `Cleanest upcoming windows: ${windows}`,
    `Household: ${household}; commute: ${profile.commute}; cooking: ${profile.cooking}; purifier: ${profile.purifier ? 'yes' : 'no'}; heating: ${profile.heating}`,
  ].join('\n');
}

/** Compose the full prompt for a question. */
export function buildPrompt(context, question) {
  return `Context:\n${context}\n\nQuestion: ${sanitizeQuestion(question)}`;
}

/** Detect Chrome's built-in Prompt API. */
export async function onDeviceAvailable(globalObj = globalThis) {
  try {
    const LM = globalObj.LanguageModel;
    if (!LM || typeof LM.availability !== 'function') return false;
    // Only use the model when it is already on the device: 'downloadable' or
    // 'downloading' would make the user wait for a multi-gigabyte download.
    return (await LM.availability(LM_OPTIONS)) === 'available';
  } catch {
    return false;
  }
}

async function askOnDevice(prompt, globalObj) {
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

/** Gemini API call (bring-your-own-key). */
export async function askGemini(prompt, apiKey, { model = DEFAULT_MODEL, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error('Missing API key');
  const safeModel = /^[a-z0-9.\-]+$/i.test(model) ? model : DEFAULT_MODEL;
  const res = await fetchImpl(`${GEMINI_ENDPOINT}/${safeModel}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini request failed (${res.status})`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

/**
 * Rule-based answer used when no model is available. Picks the most relevant
 * recommendations for the question by keyword overlap.
 * @param {string} question
 * @param {{ title: string, action: string, impact: string, group: string }[]} recs
 */
export function fallbackAnswer(question, recs) {
  const q = sanitizeQuestion(question).toLowerCase();
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const scored = recs.map((r, i) => {
    const hay = `${r.title} ${r.action} ${r.group}`.toLowerCase();
    const score = words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
    return { r, score, i };
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  const top = scored.slice(0, 2).map(({ r }) => `${r.title}: ${r.action} Why: ${r.impact}`);
  return `Here is what matters most right now. ${top.join(' ')}`;
}

/**
 * Ask a question using the best available provider.
 * @returns {Promise<{ text: string, provider: 'on-device'|'gemini'|'rules' }>}
 */
export async function ask({
  question, context, recs, apiKey, model, fetchImpl = fetch, globalObj = globalThis, timeoutMs = MODEL_TIMEOUT_MS,
}) {
  const prompt = buildPrompt(context, question);
  if (await onDeviceAvailable(globalObj)) {
    try {
      return { text: await withTimeout(askOnDevice(prompt, globalObj), timeoutMs), provider: 'on-device' };
    } catch { /* fall through */ }
  }
  if (apiKey) {
    try {
      return { text: await withTimeout(askGemini(prompt, apiKey, { model, fetchImpl }), timeoutMs), provider: 'gemini' };
    } catch { /* fall through */ }
  }
  return { text: fallbackAnswer(question, recs), provider: 'rules' };
}
