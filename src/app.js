// @ts-check
/**
 * UI controller. All dynamic text is written with textContent / DOM APIs
 * (never innerHTML) so data from APIs or the model cannot inject markup.
 */

import { naqi, category } from './aqi.js';
import { upcoming, bestWindows, worstHour, formatRange } from './forecast.js';
import { outingComparison } from './impact.js';
import { placeLabel, chartModel, answerParagraphs, providerLabel } from './view.js';
import { advise, normaliseProfile } from './advisor.js';
import { searchPlaces, fetchAirQuality } from './api.js';
import { ask, buildContext, onDeviceAvailable, sanitizeQuestion } from './ai.js';

const $ = (sel) => document.querySelector(sel);
const PROFILE_KEY = 'saans.profile.v1';
const GROUP_LABEL = { health: 'Protect health', routine: 'Daily routine', indoor: 'Indoor air', sustainable: 'Sustainable switch' };

const state = { place: null, air: null, result: null, apiKey: '' };

/**
 * Create an element safely (text via textContent only).
 * @param {string} tag
 * @param {{ cls?: string, text?: string, attrs?: Record<string, string> }} [opts]
 * @param {Node[]} [children]
 */
function el(tag, { cls, text, attrs } = {}, children = []) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(c);
  return node;
}

function setStatus(msg) {
  $('#status').textContent = msg;
}

function readProfile() {
  const f = $('#profile');
  return normaliseProfile({
    children: f.children.checked,
    elderly: f.elderly.checked,
    respiratory: f.respiratory.checked,
    purifier: f.purifier.checked,
    commute: f.commute.value,
    cooking: f.cooking.value,
    heating: f.heating.value,
  });
}

function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null');
    if (!saved) return;
    const p = normaliseProfile(saved);
    const f = $('#profile');
    for (const k of ['children', 'elderly', 'respiratory', 'purifier']) f[k].checked = p[k];
    for (const k of ['commute', 'cooking', 'heating']) f[k].value = p[k];
  } catch { /* storage unavailable or corrupt: ignore */ }
}

function saveProfile(p) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

function renderPlaces(list) {
  const ul = $('#places');
  ul.replaceChildren();
  if (!list.length) {
    ul.append(el('li', { cls: 'muted', text: 'No places found. Try another spelling.' }));
    return;
  }
  for (const p of list) {
    const b = el('button', { cls: 'place-btn', text: placeLabel(p), attrs: { type: 'button' } });
    b.addEventListener('click', () => loadAir(p));
    ul.append(el('li', {}, [b]));
  }
  ul.querySelector('button')?.focus();
}

function renderNow() {
  const { place, air } = state;
  const cur = air.current;
  const idx = naqi({ pm25: cur.pm2_5, pm10: cur.pm10 });
  const level = category(idx.value);
  const gauge = $('#gauge');
  gauge.className = `gauge lvl-${level.key}`;
  gauge.style.setProperty('--pct', String(Math.min(idx.value / 500, 1)));
  gauge.replaceChildren(el('span', { cls: 'num', text: String(idx.value) }), el('span', { cls: 'unit', text: 'NAQI' }));
  gauge.setAttribute('aria-label', `India air quality index ${idx.value}, ${level.label}`);
  $('#place-name').textContent = placeLabel(place);
  $('#level').textContent = level.label;
  $('#level').className = `level lvl-${level.key}`;
  $('#level-advice').textContent = level.advice;

  const dl = $('#pollutants');
  dl.replaceChildren();
  const rows = [['PM2.5', cur.pm2_5], ['PM10', cur.pm10], ['NO₂', cur.nitrogen_dioxide], ['O₃', cur.ozone]];
  for (const [k, v] of rows) {
    dl.append(el('div', {}, [el('dt', { text: k }), el('dd', { text: Number.isFinite(v) ? `${Math.round(v)} µg/m³` : 'n/a' })]));
  }
  return { idx, level };
}

function renderChart(points, windows) {
  const chart = $('#chart');
  const { bars, summary } = chartModel(points, windows);
  chart.replaceChildren(...bars.map((b) => {
    const bar = el('div', { cls: `bar lvl-${b.level}${b.best ? ' best' : ''}`, attrs: { title: b.title } });
    bar.style.setProperty('--h', String(b.height));
    return el('div', { cls: 'col' }, [bar, el('span', { cls: 'hr', text: b.label })]);
  }));
  chart.setAttribute('aria-label', summary);

  const ul = $('#windows');
  ul.replaceChildren();
  for (const w of windows) {
    ul.append(el('li', { text: `${formatRange(w.start, w.end)} · avg ${w.avgPm25} µg/m³ PM2.5` }));
  }
  if (!windows.length) ul.append(el('li', { cls: 'muted', text: 'No clean window in waking hours. Limit time outdoors.' }));
}

function renderImpact(pm25, windows) {
  const box = $('#impact');
  if (!Number.isFinite(pm25)) { box.hidden = true; return; }
  const o = outingComparison({ nowPm25: pm25, windowPm25: windows[0]?.avgPm25 ?? null });
  const items = [
    ['1-hour walk now', `${o.now} µg`, 'PM2.5 inhaled (estimate)'],
    o.inWindow == null ? null
      : [`Same walk at ${formatRange(windows[0].start, windows[0].end)}`, `${o.inWindow} µg`, `${o.windowSaving}% less`],
    ['Now, with a fitted N95', `${o.withMask} µg`, `up to ${o.maskSaving}% less`],
  ].filter(Boolean);
  box.replaceChildren(...items.map(([k, v, n]) => el('div', { cls: 'imp' }, [
    el('p', { cls: 'k', text: k }), el('p', { cls: 'v', text: v }), el('p', { cls: 'n', text: n }),
  ])));
  box.hidden = false;
}

function renderRecs() {
  const box = $('#recs');
  box.replaceChildren();
  for (const r of state.result.recs) {
    box.append(el('article', { cls: `rec g-${r.group}` }, [
      el('p', { cls: 'grp', text: GROUP_LABEL[r.group] }),
      el('h3', { text: r.title }),
      el('p', { text: r.action }),
      el('p', { cls: 'impact' }, [el('strong', { text: 'Impact: ' }), document.createTextNode(r.impact)]),
    ]));
  }
}

function recompute() {
  if (!state.air) return;
  const profile = readProfile();
  saveProfile(profile);
  const { idx, level } = renderNow();
  const nowIso = String(state.air.current.time ?? state.air.hourly.time[0]);
  const points = upcoming(state.air.hourly, nowIso, 24);
  const windows = bestWindows(points, { length: 2, count: 2 });
  renderChart(points, windows);
  renderImpact(state.air.current.pm2_5, windows);
  state.result = advise({
    naqi: idx.value, pm25: state.air.current.pm2_5, lat: state.place.latitude, lon: state.place.longitude,
    windows, worst: worstHour(points),
  }, profile);
  state.context = buildContext({
    place: placeLabel(state.place), naqi: idx.value, levelLabel: level.label,
    dominant: idx.dominant, current: state.air.current, windows,
  }, profile);
  renderRecs();
}

async function loadAir(place) {
  setStatus(`Loading air quality for ${placeLabel(place)}…`);
  try {
    state.place = place;
    state.air = await fetchAirQuality(place.latitude, place.longitude);
    for (const id of ['#results', '#plan', '#ask']) $(id).hidden = false;
    recompute();
    setStatus(`Showing air quality for ${placeLabel(place)}.`);
    $('#now-h').focus?.();
  } catch (err) {
    setStatus(`Could not load air quality: ${err.message}. Please try again.`);
  }
}

async function onSearch(e) {
  e.preventDefault();
  const q = $('#city').value;
  setStatus('Searching…');
  try {
    renderPlaces(await searchPlaces(q));
    setStatus('');
  } catch (err) {
    setStatus(`Search failed: ${err.message}`);
  }
}

function onLocate() {
  if (!('geolocation' in navigator)) { setStatus('Location is not available in this browser.'); return; }
  setStatus('Finding your location…');
  navigator.geolocation.getCurrentPosition(
    (pos) => loadAir({ name: 'Your location', latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
    () => setStatus('Location permission denied. Search for your city instead.'),
    { maximumAge: 600000, timeout: 10000 },
  );
}

async function onAsk(e) {
  e?.preventDefault();
  const question = sanitizeQuestion($('#question').value);
  if (!question || !state.result) return;
  const out = $('#answer');
  out.replaceChildren(el('p', { cls: 'muted', text: 'Thinking… (on-device AI can take up to 20 seconds the first time)' }));
  const { text, provider } = await ask({
    question, context: state.context, recs: state.result.recs, apiKey: state.apiKey,
  });
  out.replaceChildren(
    el('p', { cls: 'q', text: question }),
    ...answerParagraphs(text).map((para) => el('p', { text: para })),
    el('p', { cls: 'src', text: `Answered by: ${providerLabel(provider)}` }),
  );
}

async function init() {
  loadProfile();
  $('#search-form').addEventListener('submit', onSearch);
  $('#locate').addEventListener('click', onLocate);
  $('#profile').addEventListener('change', recompute);
  $('#ask-form').addEventListener('submit', onAsk);
  $('#api-key').addEventListener('input', (e) => { state.apiKey = e.target.value.trim(); });
  for (const chip of document.querySelectorAll('.chip')) {
    chip.addEventListener('click', () => { $('#question').value = chip.textContent; onAsk(); });
  }
  $('#now-h').setAttribute('tabindex', '-1');
  if (await onDeviceAvailable()) $('#provider-badge').textContent = 'Gemini Nano ready';
}

init();
