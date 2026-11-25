import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeQuestion, buildContext, buildPrompt, ask, askGemini, fallbackAnswer, onDeviceAvailable,
  MAX_QUESTION_CHARS, withTimeout,
} from '../src/ai.js';
import { searchPlaces, fetchAirQuality, validCoords, clearCache } from '../src/api.js';

const recs = [
  { id: 'mask', group: 'health', title: 'Wear an N95 mask outdoors', action: 'Use a sealed N95.', impact: 'Filters fine particles.' },
  { id: 'purifier', group: 'indoor', title: 'Run a HEPA purifier', action: 'Close the bedroom door.', impact: 'Cuts indoor PM2.5.' },
];
const air = {
  place: 'Delhi, India', naqi: 342, levelLabel: 'Very Poor', dominant: 'pm25',
  current: { pm2_5: 180.4, pm10: 260, nitrogen_dioxide: 55, ozone: 12 },
  windows: [{ start: '2026-11-25T14:00', end: '2026-11-25T15:00', avgPm25: 110 }],
};
const profile = { children: true, elderly: false, respiratory: false, commute: 'car', cooking: 'lpg', purifier: false, heating: 'none' };

const okJson = (data) => async () => ({ ok: true, json: async () => data });

test('sanitizeQuestion strips control chars and clamps length', () => {
  assert.equal(sanitizeQuestion('  hi\u0000 there\u0007 '), 'hi there');
  assert.equal(sanitizeQuestion('x'.repeat(900)).length, MAX_QUESTION_CHARS);
  assert.equal(sanitizeQuestion(undefined), '');
});

test('context is grounded in live data and the profile', () => {
  const ctx = buildContext(air, profile);
  assert.match(ctx, /NAQI.*342.*Very Poor/);
  assert.match(ctx, /PM2\.5 180/);
  assert.match(ctx, /2 PM–4 PM/);
  assert.match(ctx, /children/);
  assert.match(buildPrompt(ctx, 'Can kids play?'), /Question: Can kids play\?$/);
});

test('falls back to rules when no model is available', async () => {
  const r = await ask({ question: 'Should I buy a purifier?', context: 'c', recs, globalObj: {} });
  assert.equal(r.provider, 'rules');
  assert.match(r.text, /HEPA purifier/);
});

test('uses Chrome on-device model when present', async () => {
  const globalObj = {
    LanguageModel: {
      availability: async () => 'available',
      create: async () => ({ prompt: async (p) => `nano:${p.includes('Question')}`, destroy() {} }),
    },
  };
  assert.equal(await onDeviceAvailable(globalObj), true);
  const r = await ask({ question: 'hi', context: 'c', recs, globalObj });
  assert.deepEqual(r, { text: 'nano:true', provider: 'on-device' });
});

test('uses Gemini with the key in a header, not the URL', async () => {
  let seen;
  const fetchImpl = async (url, opts) => {
    seen = { url, opts };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Stay in.' }] } }] }) };
  };
  const r = await ask({ question: 'q', context: 'c', recs, apiKey: 'k-123', fetchImpl, globalObj: {} });
  assert.deepEqual(r, { text: 'Stay in.', provider: 'gemini' });
  assert.ok(!seen.url.includes('k-123'));
  assert.equal(seen.opts.headers['x-goog-api-key'], 'k-123');
  assert.match(JSON.parse(seen.opts.body).systemInstruction.parts[0].text, /Saans/);
});

test('Gemini failure degrades to rules', async () => {
  const fetchImpl = async () => ({ ok: false, status: 429 });
  const r = await ask({ question: 'mask', context: 'c', recs, apiKey: 'k', fetchImpl, globalObj: {} });
  assert.equal(r.provider, 'rules');
  await assert.rejects(askGemini('p', 'k', { fetchImpl }), /429/);
  await assert.rejects(askGemini('p', ''), /Missing API key/);
});

test('on-device model is skipped while it is still downloading', async () => {
  const globalObj = { LanguageModel: { availability: async () => 'downloading', create: async () => { throw new Error('should not be called'); } } };
  assert.equal(await onDeviceAvailable(globalObj), false);
  const r = await ask({ question: 'mask', context: 'c', recs, globalObj });
  assert.equal(r.provider, 'rules');
});

test('a hanging model times out and falls back to rules', async () => {
  const globalObj = { LanguageModel: { availability: async () => 'available', create: async () => ({ prompt: () => new Promise(() => {}) }) } };
  const r = await ask({ question: 'purifier', context: 'c', recs, globalObj, timeoutMs: 20 });
  assert.equal(r.provider, 'rules');
  await assert.rejects(withTimeout(new Promise(() => {}), 10), /timed out/);
  assert.equal(await withTimeout(Promise.resolve(7), 10), 7);
});

test('fallbackAnswer ranks by keyword relevance', () => {
  assert.match(fallbackAnswer('mask for outdoors?', recs), /^Here is what matters most right now\. Wear an N95/);
});

test('searchPlaces validates and maps results', async () => {
  clearCache();
  const fetchImpl = okJson({ results: [
    { name: 'Delhi', admin1: 'Delhi', country: 'India', latitude: 28.65, longitude: 77.23 },
    { name: 'Broken', latitude: 'x', longitude: 1 },
  ] });
  const r = await searchPlaces('Delhi', fetchImpl);
  assert.equal(r.length, 1);
  assert.equal(r[0].country, 'India');
  assert.deepEqual(await searchPlaces('a', fetchImpl), []);
});

test('fetchAirQuality builds the request and checks the response', async () => {
  clearCache();
  let url;
  const fetchImpl = async (u) => { url = u; return { ok: true, json: async () => ({ current: { pm2_5: 1 }, hourly: { time: [], pm2_5: [] } }) }; };
  const r = await fetchAirQuality(28.6, 77.2, fetchImpl);
  assert.equal(r.current.pm2_5, 1);
  assert.match(url, /latitude=28\.6000/);
  assert.match(url, /hourly=pm2_5/);
  await assert.rejects(fetchAirQuality(200, 0, fetchImpl), /Invalid coordinates/);
  clearCache();
  await assert.rejects(fetchAirQuality(1, 1, async () => ({ ok: false, status: 500 })), /500/);
  assert.equal(validCoords(0, 181), false);
});
