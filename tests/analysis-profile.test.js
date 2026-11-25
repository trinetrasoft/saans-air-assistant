import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyse } from '../src/analysis.js';
import {
  loadProfile, saveProfile, normaliseProfile, sensitiveMembers, DEFAULT_PROFILE,
} from '../src/profile.js';
import { advise, RULES, buildRuleContext, byPriority } from '../src/advisor.js';
import { STORAGE_KEYS, THRESHOLDS } from '../src/config.js';

const place = { name: 'Delhi', admin1: 'Delhi', country: 'India', latitude: 28.65, longitude: 77.23 };
const hours = Array.from({ length: 24 }, (_, h) => `2026-11-25T${String(h).padStart(2, '0')}:00`);
const pm = [200, 190, 185, 180, 170, 160, 150, 120, 100, 80, 60, 50, 48, 47, 52, 70, 110, 150, 190, 220, 240, 230, 220, 210];
const air = {
  current: { time: '2026-11-25T09:00', pm2_5: 127, pm10: 129, nitrogen_dioxide: 95, ozone: 22 },
  hourly: { time: hours, pm2_5: pm },
};

/** In-memory Storage stand-in. */
function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}

test('analyse runs the full pipeline from raw data to plan and grounding', () => {
  const a = analyse(place, air, normaliseProfile({ children: true, commute: 'car' }));
  assert.equal(a.index.value, 306);
  assert.equal(a.level.label, 'Very Poor');
  assert.equal(a.points.length, 15); // 09:00 to 23:00
  assert.equal(a.windows[0].start, '2026-11-25T12:00'); // cleanest window first
  assert.equal(a.windows[0].avgPm25, 47.5);
  assert.equal(a.worst.time, '2026-11-25T20:00');
  assert.equal(a.outing.now, 152);
  assert.ok(a.plan.recs.some((r) => r.id === 'grap'));
  assert.ok(a.plan.recs.some((r) => r.id === 'commute-shift'));
  assert.match(a.context, /Location: Delhi, Delhi, India/);
  assert.match(a.context, /Vetted actions: /);
});

test('analyse tolerates missing PM data', () => {
  const a = analyse(place, { current: { time: '2026-11-25T09:00' }, hourly: { time: [], pm2_5: [] } }, DEFAULT_PROFILE);
  assert.equal(a.index.value, 0);
  assert.equal(a.outing, null);
  assert.deepEqual(a.windows, []);
});

test('profile round-trips through storage and rejects corrupt data', () => {
  const store = memoryStorage();
  assert.equal(loadProfile(store), null);
  assert.equal(saveProfile({ ...DEFAULT_PROFILE, elderly: true, commute: 'car' }, store), true);
  assert.deepEqual(loadProfile(store), { ...DEFAULT_PROFILE, elderly: true, commute: 'car' });
  store.m.set(STORAGE_KEYS.profile, '{not json');
  assert.equal(loadProfile(store), null);
  assert.equal(saveProfile(DEFAULT_PROFILE, { setItem() { throw new Error('quota'); } }), false);
  assert.equal(loadProfile(undefined), null);
});

test('sensitiveMembers lists who needs protection', () => {
  assert.equal(sensitiveMembers(normaliseProfile({ children: true, elderly: true })), 'children, older adults');
  assert.equal(sensitiveMembers(DEFAULT_PROFILE), '');
});

test('advisor is extensible: custom rules replace the defaults', () => {
  const only = () => ({ id: 'x', group: 'indoor', title: 't', action: 'a', impact: 'i', priority: 1 });
  const r = advise({ naqi: 50 }, {}, [only, () => null]);
  assert.deepEqual(r.recs.map((x) => x.id), ['x']);
  assert.ok(RULES.length >= 15);
});

test('rule context flags follow the configured thresholds', () => {
  const ctx = buildRuleContext({ naqi: THRESHOLDS.unhealthy + 1 }, {});
  assert.equal(ctx.unhealthy, true);
  assert.equal(ctx.hazardous, false);
  assert.equal(ctx.outing, null);
  assert.equal(buildRuleContext({ naqi: THRESHOLDS.hazardous + 1 }, {}).hazardous, true);
  assert.equal([{ id: 'b', priority: 1 }, { id: 'a', priority: 1 }].sort(byPriority)[0].id, 'a');
});
