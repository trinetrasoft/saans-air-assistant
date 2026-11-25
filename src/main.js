// @ts-check
/**
 * Entry point: wires events to the pure analysis pipeline and the renderers.
 * State lives in one object; every render is derived from it.
 */

import { searchPlaces, fetchAirQuality } from './api.js';
import { ask, onDeviceAvailable, sanitizeQuestion } from './ai.js';
import { analyse, NoDataError } from './analysis.js';
import { loadProfile, saveProfile } from './profile.js';
import { placeLabel } from './view.js';
import { $, setStatus } from './ui/dom.js';
import { readProfileForm, writeProfileForm } from './ui/form.js';
import { renderPlaces, renderNow, renderForecast, renderImpact, renderPlan, renderThinking, renderAnswer } from './ui/render.js';

/**
 * @typedef {import('./analysis.js').Place} Place
 * @typedef {import('./analysis.js').AirData} AirData
 * @typedef {ReturnType<typeof analyse>} Analysis
 */

const GEOLOCATION_OPTIONS = Object.freeze({ maximumAge: 10 * 60 * 1000, timeout: 10_000 });
const RESULT_SECTIONS = Object.freeze(['#results', '#plan', '#ask']);

/** @type {{ place: Place|null, air: AirData|null, analysis: Analysis|null, apiKey: string, asking: boolean }} */
const state = { place: null, air: null, analysis: null, apiKey: '', asking: false };

const profileForm = /** @type {HTMLFormElement} */ ($('#profile'));

/**
 * Re-run the analysis for the current place and profile, then render.
 * @returns {Analysis|null}
 */
function refresh() {
  if (!state.place || !state.air) return null;
  const profile = readProfileForm(profileForm);
  saveProfile(profile);
  state.analysis = analyse(state.place, state.air, profile);
  renderNow(state.place, state.air.current, state.analysis);
  renderImpact(state.analysis);
  renderForecast(state.analysis);
  renderPlan(state.analysis.plan.recs);
  document.title = `${state.analysis.level.label} air in ${state.place.name} · Saans`;
  return state.analysis;
}

/** @param {Place} place */
async function selectPlace(place) {
  setStatus(`Loading air quality for ${placeLabel(place)}…`);
  try {
    state.air = await fetchAirQuality(place.latitude, place.longitude);
    state.place = place;
    const analysis = refresh();
    for (const id of RESULT_SECTIONS) $(id).hidden = false;
    const count = analysis?.plan.recs.length ?? 0;
    setStatus(`Showing air quality for ${placeLabel(place)}. Your plan has ${count} actions.`);
    $('#now-h').focus();
  } catch (err) {
    state.place = null;
    const reason = err instanceof NoDataError ? err.message : 'the air-quality service did not respond';
    setStatus(`Could not load air quality: ${reason}. Please try again or choose another place.`);
  }
}

/** @param {SubmitEvent} event */
async function onSearch(event) {
  event.preventDefault();
  setStatus('Searching…');
  try {
    renderPlaces(await searchPlaces(/** @type {HTMLInputElement} */ ($('#city')).value), selectPlace);
    setStatus('');
  } catch (err) {
    setStatus(`Search failed: ${/** @type {Error} */ (err).message}`);
  }
}

function onLocate() {
  if (!('geolocation' in navigator)) {
    setStatus('Location is not available in this browser.');
    return;
  }
  setStatus('Finding your location…');
  navigator.geolocation.getCurrentPosition(
    (pos) => selectPlace({ name: 'Your location', latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
    () => setStatus('Location permission denied. Search for your city instead.'),
    GEOLOCATION_OPTIONS,
  );
}

/** @param {Event} [event] */
async function onAsk(event) {
  event?.preventDefault();
  const question = sanitizeQuestion(/** @type {HTMLInputElement} */ ($('#question')).value);
  if (!question || !state.analysis || state.asking) return; // one request at a time
  const button = /** @type {HTMLButtonElement} */ ($('#ask-btn'));
  state.asking = true;
  button.disabled = true;
  renderThinking();
  try {
    const answer = await ask({
      question, context: state.analysis.context, recs: state.analysis.plan.recs, apiKey: state.apiKey,
    });
    renderAnswer(question, answer);
  } finally {
    state.asking = false;
    button.disabled = false;
  }
}

/** @param {Event} event */
function onChip(event) {
  const chip = /** @type {HTMLElement} */ (event.currentTarget);
  /** @type {HTMLInputElement} */ ($('#question')).value = chip.textContent ?? '';
  onAsk();
}

async function init() {
  const saved = loadProfile();
  if (saved) writeProfileForm(profileForm, saved);
  $('#search-form').addEventListener('submit', (e) => onSearch(/** @type {SubmitEvent} */ (e)));
  $('#locate').addEventListener('click', onLocate);
  profileForm.addEventListener('change', () => {
    const analysis = refresh();
    if (analysis) setStatus(`Plan updated: ${analysis.plan.recs.length} actions.`);
  });
  $('#ask-form').addEventListener('submit', onAsk);
  $('#api-key').addEventListener('input', (e) => {
    state.apiKey = /** @type {HTMLInputElement} */ (e.target).value.trim();
  });
  for (const chip of document.querySelectorAll('.chip')) chip.addEventListener('click', onChip);
  if (await onDeviceAvailable()) $('#provider-badge').textContent = 'Gemini Nano ready';
}

init();
