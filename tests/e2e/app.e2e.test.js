/**
 * End-to-end tests: serve the real static site, mock the two external APIs,
 * and drive the UI in a headless browser. Also checks key accessibility rules.
 *
 * Run: npm run test:e2e   (CI installs Chromium via `npx playwright install`)
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('../../', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const hours = Array.from({ length: 24 }, (_, h) => `2026-11-25T${String(h).padStart(2, '0')}:00`);
const AIR = {
  current: { time: '2026-11-25T09:00', pm2_5: 127, pm10: 129, nitrogen_dioxide: 95, ozone: 22 },
  hourly: {
    time: hours,
    pm2_5: [
      200, 190, 185, 180, 170, 160, 150, 120, 100, 80, 60, 50,
      48, 47, 52, 70, 110, 150, 190, 220, 240, 230, 220, 210,
    ],
  },
};
const PLACES = { results: [{ name: 'New Delhi', admin1: 'Delhi', country: 'India', latitude: 28.63, longitude: 77.22 }] };

let server;
let browser;
let baseUrl;

before(async () => {
  server = createServer(async (req, res) => {
    const path = normalize(join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!path.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try {
      const file = path.endsWith('/') ? join(path, 'index.html') : path;
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
});

after(async () => {
  await browser?.close();
  server?.close();
});

/** Open the app with both APIs mocked. */
async function openApp() {
  const page = await browser.newPage();
  const json = (body) => (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(body),
    headers: { 'access-control-allow-origin': '*' },
  });
  await page.route('**/geocoding-api.open-meteo.com/**', json(PLACES));
  await page.route('**/air-quality-api.open-meteo.com/**', json(AIR));
  await page.goto(baseUrl);
  return page;
}

/** Search for a city and pick the first result. */
async function chooseDelhi(page) {
  await page.fill('#city', 'Delhi');
  await page.click('#search-form button[type=submit]');
  await page.click('.place-btn');
  await page.waitForSelector('.rec');
}

test('search → live air, impact, cleanest window and plan', async () => {
  const page = await openApp();
  await chooseDelhi(page);
  assert.equal(await page.textContent('#gauge .num'), '306');
  assert.equal(await page.textContent('#level'), 'Very Poor');
  assert.match(await page.textContent('#impact'), /152 µg.*57 µg.*63% less/s);
  assert.match(await page.textContent('#windows li'), /^12 PM–2 PM/);
  assert.match(await page.textContent('#recs'), /GRAP Stage II/);
  assert.match(await page.title(), /Very Poor air in New Delhi/);
  assert.match(await page.textContent('#status'), /Your plan has \d+ actions/);
  await page.close();
});

test('changing the household profile updates the plan', async () => {
  const page = await openApp();
  await chooseDelhi(page);
  assert.doesNotMatch(await page.textContent('#recs'), /wood or dung/);
  await page.selectOption('select[name=cooking]', 'biomass');
  assert.match(await page.textContent('#recs'), /Move cooking off wood or dung/);
  assert.match(await page.textContent('#status'), /Plan updated/);
  await page.close();
});

test('Ask Saans answers and says which provider answered', async () => {
  const page = await openApp();
  await chooseDelhi(page);
  await page.fill('#question', 'Should I buy a purifier?');
  await page.click('#ask-btn');
  await page.waitForSelector('#answer .src');
  assert.match(await page.textContent('#answer'), /Answered by:/);
  assert.equal(await page.getAttribute('#answer', 'aria-busy'), 'false');
  await page.close();
});

test('accessibility: names, labels, landmarks, headings and unique ids', async () => {
  const page = await openApp();
  await chooseDelhi(page);
  const report = await page.evaluate(() => {
    const visible = (el) => !el.closest('[hidden]');
    const named = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim().length > 0
      || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest('label');
    const controls = [...document.querySelectorAll('input, select, textarea')].filter(visible);
    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
    const levels = [...document.querySelectorAll('h1,h2,h3,h4')].filter(visible).map((h) => Number(h.tagName[1]));
    return {
      unlabelled: controls.filter((c) => !named(c)).map((c) => c.outerHTML),
      unnamedButtons: [...document.querySelectorAll('button')].filter((b) => visible(b) && !named(b)).length,
      imagesWithoutAlt: [...document.querySelectorAll('[role=img]')].filter((e) => !e.getAttribute('aria-label')).length,
      duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i),
      headingJumps: levels.filter((l, i) => i > 0 && l - levels[i - 1] > 1).length,
      h1: document.querySelectorAll('h1').length,
      lang: document.documentElement.lang,
      main: document.querySelectorAll('main').length,
    };
  });
  assert.deepEqual(report.unlabelled, []);
  assert.equal(report.unnamedButtons, 0);
  assert.equal(report.imagesWithoutAlt, 0);
  assert.deepEqual(report.duplicateIds, []);
  assert.equal(report.headingJumps, 0);
  assert.equal(report.h1, 1);
  assert.equal(report.lang, 'en');
  assert.equal(report.main, 1);
  await page.close();
});

test('keyboard: skip link is first and moves focus to main content', async () => {
  const page = await openApp();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Skip to content');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
  await page.close();
});
