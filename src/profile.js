// @ts-check
/**
 * Household profile: validation, defaults and persistence.
 */

import { STORAGE_KEYS } from './config.js';

/** @typedef {import('./types.js').Profile} Profile */

/** @type {readonly import('./types.js').Commute[]} */
export const COMMUTES = Object.freeze(['car', 'two-wheeler', 'public', 'walk-cycle', 'wfh']);
/** @type {readonly import('./types.js').CookingFuel[]} */
export const COOKING_FUELS = Object.freeze(['lpg', 'electric', 'biomass']);
/** @type {readonly import('./types.js').Heating[]} */
export const HEATING = Object.freeze(['none', 'electric', 'wood-coal']);

/** @type {Readonly<Profile>} */
export const DEFAULT_PROFILE = Object.freeze({
  children: false,
  elderly: false,
  respiratory: false,
  commute: 'public',
  cooking: 'lpg',
  purifier: false,
  heating: 'none',
});

/**
 * Return `value` if it is one of `allowed`, otherwise `fallback`.
 * @template T
 * @param {unknown} value
 * @param {readonly T[]} allowed
 * @param {T} fallback
 * @returns {T}
 */
function oneOf(value, allowed, fallback) {
  return allowed.includes(/** @type {T} */ (value)) ? /** @type {T} */ (value) : fallback;
}

/**
 * Sanitise an untrusted object (form values, localStorage) into a Profile.
 * @param {Record<string, unknown>} [input]
 * @returns {Profile}
 */
export function normaliseProfile(input = {}) {
  return {
    children: input.children === true,
    elderly: input.elderly === true,
    respiratory: input.respiratory === true,
    commute: oneOf(input.commute, COMMUTES, DEFAULT_PROFILE.commute),
    cooking: oneOf(input.cooking, COOKING_FUELS, DEFAULT_PROFILE.cooking),
    purifier: input.purifier === true,
    heating: oneOf(input.heating, HEATING, DEFAULT_PROFILE.heating),
  };
}

/**
 * True when anyone in the household is in a sensitive group.
 * @param {Pick<Profile, 'children'|'elderly'|'respiratory'>} p
 */
export function isSensitive(p) {
  return Boolean(p.children || p.elderly || p.respiratory);
}

/**
 * Human list of the sensitive members, e.g. "children, older adults".
 * @param {Profile} p
 */
export function sensitiveMembers(p) {
  return [
    p.children && 'children',
    p.elderly && 'older adults',
    p.respiratory && 'anyone with asthma or lung/heart conditions',
  ].filter(Boolean).join(', ');
}

/**
 * Load a saved profile. Storage is injectable for testing; any failure
 * (blocked storage, corrupt JSON) yields null.
 * @param {Pick<Storage, 'getItem'>} [storage]
 * @returns {Profile|null}
 */
export function loadProfile(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(STORAGE_KEYS.profile);
    return raw ? normaliseProfile(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/**
 * Persist a profile; returns false if storage is unavailable.
 * @param {Profile} profile
 * @param {Pick<Storage, 'setItem'>} [storage]
 */
export function saveProfile(profile, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEYS.profile, JSON.stringify(normaliseProfile({ ...profile })));
    return true;
  } catch {
    return false;
  }
}
