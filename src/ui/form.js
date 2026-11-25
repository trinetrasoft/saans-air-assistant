// @ts-check
/** Reading and writing the household-profile form. */

import { normaliseProfile } from '../profile.js';

/** @typedef {import('../types.js').Profile} Profile */

const CHECKBOXES = /** @type {const} */ (['children', 'elderly', 'respiratory', 'purifier']);
const SELECTS = /** @type {const} */ (['commute', 'cooking', 'heating']);

/**
 * @param {HTMLFormElement} form
 * @param {string} name
 * @returns {HTMLInputElement|HTMLSelectElement}
 */
function field(form, name) {
  return /** @type {HTMLInputElement|HTMLSelectElement} */ (form.elements.namedItem(name));
}

/**
 * @param {HTMLFormElement} form
 * @returns {Profile}
 */
export function readProfileForm(form) {
  /** @type {Record<string, unknown>} */
  const raw = {};
  for (const name of CHECKBOXES) raw[name] = /** @type {HTMLInputElement} */ (field(form, name)).checked;
  for (const name of SELECTS) raw[name] = field(form, name).value;
  return normaliseProfile(raw);
}

/**
 * @param {HTMLFormElement} form
 * @param {Profile} profile
 */
export function writeProfileForm(form, profile) {
  for (const name of CHECKBOXES) /** @type {HTMLInputElement} */ (field(form, name)).checked = profile[name];
  for (const name of SELECTS) field(form, name).value = profile[name];
}
