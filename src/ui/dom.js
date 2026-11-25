// @ts-check
/**
 * Minimal, safe DOM helpers. Text is only ever set with textContent, so data
 * from APIs or the model can never inject markup.
 */

/**
 * Required element lookup; throws early if the page structure is wrong.
 * @param {string} selector
 * @returns {HTMLElement}
 */
export function $(selector) {
  const node = document.querySelector(selector);
  if (!(node instanceof HTMLElement)) throw new Error(`Missing element: ${selector}`);
  return node;
}

/**
 * Create an element.
 * @param {string} tag
 * @param {{ cls?: string, text?: string, attrs?: Record<string, string> }} [opts]
 * @param {(Node|string)[]} [children]
 * @returns {HTMLElement}
 */
export function el(tag, { cls, text, attrs } = {}, children = []) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  for (const [name, value] of Object.entries(attrs ?? {})) node.setAttribute(name, value);
  node.append(...children);
  return node;
}

/**
 * Announce a status message (the region is aria-live).
 * @param {string} message
 */
export function setStatus(message) {
  $('#status').textContent = message;
}
