import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subIndex, naqi, category, BREAKPOINTS } from '../src/aqi.js';

test('PM2.5 sub-index matches CPCB band edges', () => {
  assert.equal(subIndex(0, BREAKPOINTS.pm25), 0);
  assert.equal(subIndex(30, BREAKPOINTS.pm25), 50);
  assert.equal(subIndex(60, BREAKPOINTS.pm25), 100);
  assert.equal(subIndex(90, BREAKPOINTS.pm25), 200);
  assert.equal(subIndex(120, BREAKPOINTS.pm25), 300);
  assert.equal(subIndex(250, BREAKPOINTS.pm25), 400);
});

test('PM2.5 interpolates inside a band', () => {
  // 75 µg/m³ is halfway through 61-90 -> 101 + (99/29)*14 ≈ 149
  assert.equal(subIndex(75, BREAKPOINTS.pm25), 149);
});

test('fractional values between bands go to the upper band', () => {
  assert.equal(subIndex(30.5, BREAKPOINTS.pm25), 51);
});

test('values beyond the table cap at 500', () => {
  assert.equal(subIndex(900, BREAKPOINTS.pm25), 500);
  assert.equal(subIndex(1000, BREAKPOINTS.pm10), 500);
});

test('invalid input yields null', () => {
  assert.equal(subIndex(-1, BREAKPOINTS.pm25), null);
  assert.equal(subIndex(NaN, BREAKPOINTS.pm25), null);
  assert.equal(subIndex('12', BREAKPOINTS.pm25), null);
});

test('NAQI takes the maximum sub-index and reports the dominant pollutant', () => {
  assert.deepEqual(naqi({ pm25: 150, pm10: 120 }), { value: subIndex(150, BREAKPOINTS.pm25), dominant: 'pm25' });
  assert.deepEqual(naqi({ pm25: 20, pm10: 300 }), { value: subIndex(300, BREAKPOINTS.pm10), dominant: 'pm10' });
  assert.deepEqual(naqi({ pm25: null, pm10: 40 }), { value: 40, dominant: 'pm10' });
  assert.equal(naqi({}), null);
});

test('category labels follow NAQI bands', () => {
  assert.equal(category(42).label, 'Good');
  assert.equal(category(100).label, 'Satisfactory');
  assert.equal(category(180).label, 'Moderate');
  assert.equal(category(250).label, 'Poor');
  assert.equal(category(350).label, 'Very Poor');
  assert.equal(category(480).label, 'Severe');
});
