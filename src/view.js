// @ts-check
/**
 * Pure view-model helpers (no DOM access) so rendering logic is unit-testable.
 */

import { naqi, category } from './aqi.js';
import { formatHour } from './forecast.js';

/** @param {{ name: string, admin1?: string, country?: string }} p */
export function placeLabel(p) {
  return [p.name, p.admin1, p.country].filter(Boolean).join(', ');
}

/**
 * Bars for the hourly chart.
 * @param {{ time: string, pm25: number }[]} points
 * @param {{ start: string, end: string }[]} windows
 */
export function chartModel(points, windows) {
  const max = Math.max(60, ...points.map((p) => p.pm25));
  const bars = points.map((p) => {
    const idx = naqi({ pm25: p.pm25 });
    return {
      label: formatHour(p.time).replace(' ', ''),
      title: `${formatHour(p.time)}: ${Math.round(p.pm25)} µg/m³`,
      height: Math.round((p.pm25 / max) * 1000) / 1000,
      level: idx ? category(idx.value).key : 'good',
      best: windows.some((w) => p.time >= w.start && p.time <= w.end),
    };
  });
  const values = points.map((p) => p.pm25);
  const summary = points.length
    ? `Hourly PM2.5 forecast from ${formatHour(points[0].time)}; highest ${Math.round(Math.max(...values))}, lowest ${Math.round(Math.min(...values))} µg/m³.`
    : 'Forecast unavailable.';
  return { bars, summary };
}

/**
 * Split a model answer into plain-text paragraphs, removing Markdown emphasis
 * markers (the text is always rendered with textContent, never as HTML).
 * @param {string} text
 */
export function answerParagraphs(text) {
  return String(text)
    .replace(/\*\*|__/g, '')
    .split(/\n{2,}|\n(?=[-•*] )/)
    .map((p) => p.replace(/^[-•*]\s+/, '• ').trim())
    .filter(Boolean);
}

/** @type {Readonly<Record<string, string>>} */
const PROVIDER_LABELS = Object.freeze({
  'on-device': 'On-device Gemini Nano', gemini: 'Gemini API', rules: 'Built-in guidance engine',
});

/**
 * Human label for the provider that answered.
 * @param {string} provider
 */
export function providerLabel(provider) {
  return PROVIDER_LABELS[provider] ?? 'Saans';
}
