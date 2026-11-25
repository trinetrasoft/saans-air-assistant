import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advise, normaliseProfile, isSensitive } from '../src/advisor.js';

const windows = [{ start: '2026-11-25T13:00', end: '2026-11-25T14:00', avgPm25: 42 }];
const ids = (r) => r.recs.map((x) => x.id);

test('normaliseProfile rejects unknown values', () => {
  const p = normaliseProfile({ commute: 'rocket', cooking: 'biomass', children: 'yes', purifier: true });
  assert.equal(p.commute, 'public');
  assert.equal(p.cooking, 'biomass');
  assert.equal(p.children, false);
  assert.equal(p.purifier, true);
});

test('severe air triggers health protection first', () => {
  const r = advise({ naqi: 420, windows, worst: { time: '2026-11-25T21:00', pm25: 300 } }, { children: true });
  assert.equal(r.level.label, 'Severe');
  assert.ok(r.sensitive);
  for (const id of ['mask', 'sensitive-indoors', 'no-exercise', 'purifier', 'avoid-peak']) {
    assert.ok(ids(r).includes(id), `missing ${id}`);
  }
  assert.equal(r.recs[0].priority, 1);
});

test('good air does not push masks or indoor confinement', () => {
  const r = advise({ naqi: 40, windows }, {});
  assert.ok(!ids(r).includes('mask'));
  assert.ok(!ids(r).includes('sensitive-indoors'));
  assert.ok(!ids(r).includes('no-exercise'));
});

test('profile drives sustainable alternatives', () => {
  const r = advise({ naqi: 250, windows }, { commute: 'car', cooking: 'biomass', heating: 'wood-coal' });
  for (const id of ['commute-shift', 'clean-cooking', 'heating']) assert.ok(ids(r).includes(id));
});

test('every recommendation explains its impact', () => {
  const r = advise({ naqi: 330, windows, worst: { time: '2026-11-25T20:00', pm25: 210 } },
    { elderly: true, commute: 'two-wheeler', purifier: true });
  assert.ok(r.recs.length >= 6);
  for (const rec of r.recs) {
    assert.ok(rec.impact.length > 20, rec.id);
    assert.ok(['health', 'routine', 'indoor', 'sustainable'].includes(rec.group));
  }
  assert.ok(ids(r).includes('purifier-use'));
  assert.ok(!ids(r).includes('purifier'));
});

test('recommendations are sorted by priority', () => {
  const r = advise({ naqi: 310, windows }, { respiratory: true });
  const pr = r.recs.map((x) => x.priority);
  assert.deepEqual(pr, [...pr].sort((a, b) => a - b));
  assert.ok(isSensitive({ respiratory: true }));
});
