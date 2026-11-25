import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  inhaledDose, percentReduction, outingComparison, inDelhiNcr, grapStage, BREATHING_RATE_M3_PER_H,
} from '../src/impact.js';
import { placeLabel, chartModel, answerParagraphs, providerLabel } from '../src/view.js';
import { advise } from '../src/advisor.js';

test('inhaled dose = concentration × breathing rate × hours', () => {
  assert.equal(inhaledDose(100, 1), 100 * BREATHING_RATE_M3_PER_H.light);
  assert.equal(inhaledDose(100, 2, 'rest'), 100);
  assert.equal(inhaledDose(-5, 1), 0);
  assert.equal(inhaledDose(NaN, 1), 0);
});

test('percentReduction is clamped to 0-100', () => {
  assert.equal(percentReduction(200, 50), 75);
  assert.equal(percentReduction(50, 200), 0);
  assert.equal(percentReduction(0, 10), 0);
});

test('outingComparison quantifies window and mask savings', () => {
  const o = outingComparison({ nowPm25: 127, windowPm25: 50.9 });
  assert.equal(o.now, 152);
  assert.equal(o.inWindow, 61);
  assert.equal(o.windowSaving, 60);
  assert.equal(o.withMask, 8);
  assert.equal(o.maskSaving, 95);
  assert.equal(outingComparison({ nowPm25: 80, windowPm25: null }).inWindow, null);
});

test('GRAP stages for Delhi-NCR', () => {
  assert.equal(grapStage(180), null);
  assert.equal(grapStage(250).stage, 'I');
  assert.equal(grapStage(305).stage, 'II');
  assert.equal(grapStage(430).stage, 'III');
  assert.equal(grapStage(470).stage, 'IV');
  assert.ok(inDelhiNcr(28.65, 77.23));
  assert.ok(inDelhiNcr(28.46, 77.03)); // Gurugram
  assert.ok(!inDelhiNcr(17.38, 78.48)); // Hyderabad
});

test('advisor adds quantified impact and GRAP guidance in Delhi only', () => {
  const windows = [{ start: '2026-11-25T12:00', end: '2026-11-25T13:00', avgPm25: 50.9 }];
  const delhi = advise({ naqi: 305, pm25: 127, lat: 28.65, lon: 77.23, windows }, {});
  const best = delhi.recs.find((r) => r.id === 'best-window');
  assert.match(best.impact, /152 µg to 61 µg, 60% less/);
  assert.match(delhi.recs.find((r) => r.id === 'mask').impact, /about 8 µg/);
  assert.match(delhi.recs.find((r) => r.id === 'grap').title, /Stage II/);
  const hyd = advise({ naqi: 305, pm25: 127, lat: 17.38, lon: 78.48, windows }, {});
  assert.ok(!hyd.recs.some((r) => r.id === 'grap'));
});

test('placeLabel joins available parts', () => {
  assert.equal(placeLabel({ name: 'Delhi', admin1: 'NCT', country: 'India' }), 'Delhi, NCT, India');
  assert.equal(placeLabel({ name: 'Your location' }), 'Your location');
});

test('chartModel scales bars, marks best windows and summarises for screen readers', () => {
  const pts = [
    { time: '2026-11-25T12:00', pm25: 30 },
    { time: '2026-11-25T13:00', pm25: 120 },
  ];
  const { bars, summary } = chartModel(pts, [{ start: '2026-11-25T12:00', end: '2026-11-25T12:00' }]);
  assert.equal(bars[0].height, 0.25);
  assert.equal(bars[1].height, 1);
  assert.ok(bars[0].best && !bars[1].best);
  assert.equal(bars[0].level, 'good');
  assert.equal(bars[1].level, 'poor');
  assert.equal(bars[0].label, '12PM');
  assert.match(summary, /highest 120, lowest 30/);
  assert.equal(chartModel([], []).summary, 'Forecast unavailable.');
});

test('answerParagraphs strips markdown emphasis and splits bullets', () => {
  assert.deepEqual(answerParagraphs('**Stay in.**\n\n- Close windows\n- Run purifier'), [
    'Stay in.', '• Close windows', '• Run purifier',
  ]);
  assert.equal(providerLabel('on-device'), 'On-device Gemini Nano');
  assert.equal(providerLabel('x'), 'Saans');
});
