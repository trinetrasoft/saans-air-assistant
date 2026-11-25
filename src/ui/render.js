// @ts-check
/** Rendering functions: each takes data and updates one region of the page. */

import { formatRange } from '../forecast.js';
import { chartModel, answerParagraphs, providerLabel, placeLabel } from '../view.js';
import { $, el } from './dom.js';

/**
 * @typedef {import('../analysis.js').Place} Place
 * @typedef {ReturnType<typeof import('../analysis.js').analyse>} Analysis
 */

const GROUP_LABEL = Object.freeze({
  health: 'Protect health', routine: 'Daily routine', indoor: 'Indoor air', sustainable: 'Sustainable switch',
});
const GAUGE_MAX = 500;
const POLLUTANTS = Object.freeze([['PM2.5', 'pm2_5'], ['PM10', 'pm10'], ['NO₂', 'nitrogen_dioxide'], ['O₃', 'ozone']]);

/**
 * @param {Place[]} places
 * @param {(place: Place) => void} onPick
 */
export function renderPlaces(places, onPick) {
  const list = $('#places');
  if (!places.length) {
    list.replaceChildren(el('li', { cls: 'muted', text: 'No places found. Try another spelling.' }));
    return;
  }
  list.replaceChildren(...places.map((place) => {
    const button = el('button', { cls: 'place-btn', text: placeLabel(place), attrs: { type: 'button' } });
    button.addEventListener('click', () => onPick(place));
    return el('li', {}, [button]);
  }));
  list.querySelector('button')?.focus();
}

/**
 * @param {Place} place
 * @param {Record<string, any>} current
 * @param {Analysis} a
 */
export function renderNow(place, current, { index, level }) {
  const gauge = $('#gauge');
  gauge.className = `gauge lvl-${level.key}`;
  gauge.style.setProperty('--pct', String(Math.min(index.value / GAUGE_MAX, 1)));
  gauge.replaceChildren(el('span', { cls: 'num', text: String(index.value) }), el('span', { cls: 'unit', text: 'NAQI' }));
  gauge.setAttribute('aria-label', `India air quality index ${index.value}, ${level.label}`);
  $('#place-name').textContent = placeLabel(place);
  const levelEl = $('#level');
  levelEl.textContent = level.label;
  levelEl.className = `level lvl-${level.key}`;
  $('#level-advice').textContent = level.advice;
  $('#pollutants').replaceChildren(...POLLUTANTS.map(([label, key]) => {
    const v = current[key];
    return el('div', {}, [el('dt', { text: label }), el('dd', { text: Number.isFinite(v) ? `${Math.round(v)} µg/m³` : 'n/a' })]);
  }));
}

/** @param {Analysis} a */
export function renderForecast({ points, windows }) {
  const chart = $('#chart');
  const { bars, summary } = chartModel(points, windows);
  chart.replaceChildren(...bars.map((b) => {
    const bar = el('div', { cls: `bar lvl-${b.level}${b.best ? ' best' : ''}`, attrs: { title: b.title } });
    bar.style.setProperty('--h', String(b.height));
    return el('div', { cls: 'col' }, [bar, el('span', { cls: 'hr', text: b.label, attrs: { 'aria-hidden': 'true' } })]);
  }));
  chart.setAttribute('aria-label', summary);
  const items = windows.map((w) => el('li', { text: `${formatRange(w.start, w.end)} · avg ${w.avgPm25} µg/m³ PM2.5` }));
  $('#windows').replaceChildren(...(items.length ? items
    : [el('li', { cls: 'muted', text: 'No clean window in waking hours. Limit time outdoors.' })]));
}

/** @param {Analysis} a */
export function renderImpact({ outing, windows }) {
  const box = $('#impact');
  box.hidden = !outing;
  if (!outing) return;
  const cards = [['1-hour walk now', `${outing.now} µg`, 'PM2.5 inhaled (estimate)']];
  if (outing.inWindow != null) {
    cards.push([`Same walk at ${formatRange(windows[0].start, windows[0].end)}`, `${outing.inWindow} µg`, `${outing.windowSaving}% less`]);
  }
  cards.push(['Now, with a fitted N95', `${outing.withMask} µg`, `up to ${outing.maskSaving}% less`]);
  box.replaceChildren(...cards.map(([label, value, note]) => el('div', { cls: 'imp' }, [
    el('p', { cls: 'k', text: label }), el('p', { cls: 'v', text: value }), el('p', { cls: 'n', text: note }),
  ])));
}

/** @param {import('../types.js').Rec[]} recs */
export function renderPlan(recs) {
  $('#recs').replaceChildren(...recs.map((r) => el('article', { cls: `rec g-${r.group}` }, [
    el('p', { cls: 'grp', text: GROUP_LABEL[r.group] }),
    el('h3', { text: r.title }),
    el('p', { text: r.action }),
    el('p', { cls: 'impact' }, [el('strong', { text: 'Impact: ' }), r.impact]),
  ])));
}

/** Show the pending state for an AI question. */
export function renderThinking() {
  const out = $('#answer');
  out.setAttribute('aria-busy', 'true');
  out.replaceChildren(el('p', { cls: 'muted', text: 'Thinking… (on-device AI can take up to 20 seconds the first time)' }));
}

/**
 * @param {string} question
 * @param {import('../ai.js').Answer} answer
 */
export function renderAnswer(question, { text, provider, fallbacks }) {
  const out = $('#answer');
  const source = [`Answered by: ${providerLabel(provider)}`, ...fallbacks].join('. ');
  out.replaceChildren(
    el('p', { cls: 'q', text: question }),
    ...answerParagraphs(text).map((para) => el('p', { text: para })),
    el('p', { cls: 'src', text: source }),
  );
  out.setAttribute('aria-busy', 'false');
}
