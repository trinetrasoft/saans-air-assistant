# Saans: Urban Air Quality Assistant

**PromptWars Virtual · Challenge 6: Urban Air Quality Assistant** · by Trinetra Soft

*Saans* means "breath" in Hindi. Saans is a GenAI-powered assistant that helps families and communities get through winter smog. It shows:

- the air right now
- the cleanest hours of the day
- low-emission routines, indoor-air tips and sustainable alternatives tailored to the household

Every suggestion comes with a plain-language explanation of the impact of that choice.

**Live app:** https://trinetrasoft.github.io/saans-air-assistant/

## Chosen vertical

**Challenge 6: Urban Air Quality Assistant.** The persona is a family in an Indian city during winter smog: parents with young children or older relatives, someone with asthma, a daily commute and a home kitchen. They need to know **when** it is safe to be outside, **what** to change at home and on the road, and **how much** each choice actually helps.

## Approach and logic

1. **Measure:** fetch live PM2.5/PM10/NO₂/O₃ and a 48-hour PM2.5 forecast for the chosen place (Open-Meteo / CAMS), and convert them to **India's NAQI** with the official CPCB breakpoints.
2. **Find the clean hours:** scan the next 24 hours for the two cleanest non-overlapping 2-hour windows in waking hours (06:00–22:00) and the worst peak hour.
3. **Quantify impact:** estimate PM2.5 inhaled during a 1-hour walk (*dose = concentration × breathing rate*, US EPA values) now, in the cleanest window, and with a fitted N95.
4. **Decide (user context):** a **rule-based advisor** with 16 small rules in `src/rules/` turns the situation and the household profile (sensitive members, commute, cooking fuel, heating, purifier) into ranked actions in four groups: protect health, daily routine, indoor air and sustainable switches. Each action has an **Impact** line. Delhi-NCR locations also get the **GRAP stage** implied by the reading.
5. **Explain (GenAI):** "Ask Saans" sends the live data, profile and vetted actions as grounding to Gemini (on-device Gemini Nano, or the Gemini API with the user's key). The model personalises and explains the plan; it never invents the numbers.

## How the solution works

`main.js` handles events → `api.js` fetches data → `analysis.js` (a pure function) produces the index, forecast windows, impact estimate, ranked plan and AI grounding → `ui/render.js` paints each region. Changing any profile field re-runs the pure pipeline instantly, with no network call. AI answers go through `ai.js`, which tries providers in order with timeouts and tells the user which one answered and why any were skipped. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Assumptions

- **NAQI is estimated** from *current* PM2.5/PM10 concentrations. CPCB's official index uses 24-hour averages and more pollutants, so values can differ from station readings.
- Forecast data is modelled (CAMS via Open-Meteo), not from a ground station; it is good for planning, not compliance.
- Inhaled-dose figures use typical adult breathing rates (~1.2 m³/h for light activity) and the ≥95% rated N95 efficiency. They are estimates that assume a well-fitted mask.
- GRAP stages are inferred from the reading inside an approximate Delhi-NCR bounding box. The legally binding stage is whatever CAQM has ordered.
- Gemini Nano is used only when Chrome already has it installed. Otherwise users can add their own Gemini key, or rely on the deterministic guidance engine.
- Advice is general public-health guidance, not medical advice.

## What it does

| Step | Feature |
|---|---|
| 1. Where are you? | City search (Open-Meteo geocoding) or browser geolocation |
| 2. Household | Children, older adults, respiratory conditions, commute mode, cooking fuel, heating, purifier. Saved only in this browser |
| 3. Air right now | **India NAQI** computed from live PM2.5/PM10 with CPCB breakpoints, category and health advice, plus pollutants (PM2.5, PM10, NO₂, O₃) |
| What one hour outside costs you | **Quantified impact**: PM2.5 inhaled during a 1-hour walk now vs in the cleanest window vs with an N95 (dose = concentration × breathing rate, EPA values) |
| Delhi-NCR | Detects NCR locations and explains the **GRAP stage** implied by the reading |
| Cleanest hours | Hourly PM2.5 forecast chart with the **two cleanest 2-hour windows** in waking hours, and the worst peak to avoid |
| 4. Your plan | Ranked, explainable actions grouped as *Protect health · Daily routine · Indoor air · Sustainable switch*, each with an **Impact** line |
| 5. Ask Saans | GenAI Q&A grounded in live readings, the forecast and the household profile |

## Generative AI

"Ask Saans" builds a grounded prompt from the live data and the profile, under a safety-focused system instruction: stay on topic, no diagnoses, explain the impact of each suggestion, 120 words at most. It then uses the best provider available:

1. **Chrome built-in AI (Gemini Nano, Prompt API).** Runs on-device and privately, with no key needed.
2. **Google Gemini API (`gemini-flash-latest`).** Uses the user's own key, sent only in the `x-goog-api-key` header and kept in memory for that tab.
3. **Built-in guidance engine.** A deterministic fallback that ranks the relevant recommendations, so the app never breaks.

The recommendation engine itself is deterministic and fully tested. The model *explains and personalises* it; it does not invent the data.

## Quality

- **Testing:** 44 unit tests (`npm test`, about 99% line coverage of the logic) plus 5 browser end-to-end tests (`npm run test:e2e`, Playwright). The end-to-end tests serve the real site with mocked APIs and check search → plan → AI answer, live profile updates, keyboard navigation and automated accessibility rules (labels, names, headings, unique ids, landmarks). All of them run in CI.
- **Code quality:** a rule-based advisor (one small function per piece of advice), central config, and shared types. Strict TypeScript checking of JSDoc-typed JavaScript (`tsc --strict`). ESLint enforces complexity ≤ 10, functions ≤ 60 lines, files ≤ 250 lines and lines ≤ 120 characters. Errors are never swallowed silently: AI fallbacks are reported to the user. CI runs lint, type check and tests on every push. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- **Security** ([SECURITY.md](SECURITY.md)): a strict Content-Security-Policy that whitelists only the APIs it calls. No `innerHTML`: all dynamic text goes through `textContent`. User input is sanitised and capped. The profile is validated against an allow-list. The API key is never placed in a URL or stored persistently. `no-referrer`. No dependencies.
- **Efficiency:** about 30 KB, zero runtime dependencies, no build step. API responses are cached in memory for 10 minutes, and requests time out after 10 s.
- **Accessibility** ([docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md)): semantic landmarks, a skip link, labelled controls, `aria-live` updates, a text alternative for the gauge and chart, colour always paired with text, visible focus rings and `prefers-reduced-motion`.

## Run locally

```bash
npm test                 # unit tests (Node 20+, no install needed)
npm install && npm run check   # lint + strict type check + unit tests
npx playwright install chromium && npm run test:e2e   # browser end-to-end tests
python3 -m http.server   # then open http://localhost:8000
```

## Structure

```
index.html            UI shell, CSP
styles.css            responsive, accessible styles
src/main.js           entry point: events and state
src/analysis.js       pure pipeline: raw data + profile → index, windows, impact, plan, AI context
src/config.js         endpoints, limits, thresholds          src/types.js  shared JSDoc types
src/aqi.js            CPCB NAQI sub-indices and categories
src/forecast.js       upcoming hours, cleanest windows, peak hour
src/impact.js         inhaled-dose model, % savings, Delhi-NCR GRAP stages
src/advisor.js        runs the rules and ranks recommendations
src/rules/*.js        health, routine, indoor and sustainable rules
src/profile.js        profile validation and persistence
src/api.js            Open-Meteo clients (timeouts, bounded cache, validation)
src/ai.js             provider orchestration with timeouts
src/ai/prompt.js      system instruction and grounded context
src/ai/providers.js   Gemini Nano, Gemini API and deterministic fallback
src/view.js           pure view-models (chart, answers)
src/ui/*.js           DOM helpers, form binding, renderers
tests/*.test.js       unit tests (node:test)
tests/e2e/            browser end-to-end and accessibility tests (Playwright)
```

Data: [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) (CAMS). NAQI breakpoints are from India's CPCB. This app does not give medical advice.

License: MIT
