import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upcoming, bestWindows, worstHour, formatHour, formatRange, hourOf } from '../src/forecast.js';

function series(startHour, values, day = '2026-11-25') {
  return values.map((v, i) => {
    const h = startHour + i;
    const d = h >= 24 ? '2026-11-26' : day;
    return { time: `${d}T${String(h % 24).padStart(2, '0')}:00`, pm25: v };
  });
}

test('hourOf and formatHour', () => {
  assert.equal(hourOf('2026-11-25T07:00'), 7);
  assert.equal(formatHour('2026-11-25T00:00'), '12 AM');
  assert.equal(formatHour('2026-11-25T13:00'), '1 PM');
  assert.equal(formatHour('bad'), '');
  assert.equal(formatRange('2026-11-25T12:00', '2026-11-25T13:00'), '12 PM–2 PM');
  assert.equal(formatRange('2026-11-25T23:00', '2026-11-25T23:00'), '11 PM–12 AM');
});

test('upcoming drops past hours and missing values', () => {
  const hourly = {
    time: ['2026-11-25T08:00', '2026-11-25T09:00', '2026-11-25T10:00', '2026-11-25T11:00'],
    pm2_5: [50, 60, null, 70],
  };
  const pts = upcoming(hourly, '2026-11-25T09:15', 24);
  assert.deepEqual(pts.map((p) => p.time), ['2026-11-25T09:00', '2026-11-25T11:00']);
  assert.deepEqual(upcoming(null, '2026-11-25T09:00'), []);
});

test('bestWindows picks the cleanest non-overlapping waking-hour windows', () => {
  // 06..17: clean at 13-14 and 16-17
  const pts = series(6, [200, 190, 180, 170, 160, 150, 140, 40, 45, 120, 30, 35]);
  const w = bestWindows(pts, { length: 2, count: 2 });
  assert.equal(w.length, 2);
  assert.equal(w[0].start, '2026-11-25T13:00');
  assert.equal(w[1].start, '2026-11-25T16:00');
  assert.equal(w[1].avgPm25, 32.5);
});

test('bestWindows ignores night hours', () => {
  const pts = series(0, [5, 5, 5, 5, 5, 5, 100, 100, 90, 90]);
  const w = bestWindows(pts, { length: 2, count: 1 });
  assert.equal(w[0].start, '2026-11-25T08:00');
});

test('worstHour', () => {
  const pts = series(10, [10, 90, 30]);
  assert.equal(worstHour(pts).time, '2026-11-25T11:00');
  assert.equal(worstHour([]), null);
});
