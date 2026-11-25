# Saans: Urban Air Quality Assistant

**PromptWars Virtual · Challenge 6: Urban Air Quality Assistant** · by Trinetra Soft

*Saans* means "breath" in Hindi. Saans is a GenAI-powered assistant that helps families and communities get through winter smog. It shows:

- the air right now
- the cleanest hours of the day
- low-emission routines, indoor-air tips and sustainable alternatives tailored to the household

Every suggestion comes with a plain-language explanation of the impact of that choice.

**Live app:** https://trinetrasoft.github.io/saans-air-assistant/

## What it does

| Step | Feature |
|---|---|
| 1. Where are you? | City search (Open-Meteo geocoding) or browser geolocation |
| 2. Household | Children, older adults, respiratory conditions, commute mode, cooking fuel, heating, purifier. Saved only in this browser |
| 3. Air right now | **India NAQI** computed from live PM2.5/PM10 with CPCB breakpoints, category and health advice, plus pollutants (PM2.5, PM10, NO₂, O₃) |
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

- **Testing:** 29 unit tests with Node's built-in test runner (`npm test`), about 99% line coverage of `src/`. CI runs on every push.
- **Security:** a strict Content-Security-Policy that whitelists only the APIs it calls. No `innerHTML`: all dynamic text goes through `textContent`. User input is sanitised and capped. The profile is validated against an allow-list. The API key is never placed in a URL or stored persistently. `no-referrer`. No dependencies.
- **Efficiency:** about 30 KB, zero runtime dependencies, no build step. API responses are cached in memory for 10 minutes, and requests time out after 10 s.
- **Accessibility:** semantic landmarks, a skip link, labelled controls, `aria-live` updates, a text alternative for the gauge and chart, colour always paired with text, visible focus rings and `prefers-reduced-motion`.

## Run locally

```bash
npm test                 # unit tests (Node 20+)
python3 -m http.server   # then open http://localhost:8000
```

## Structure

```
index.html        UI shell, CSP
styles.css        responsive, accessible styles
src/aqi.js        CPCB NAQI sub-indices and categories
src/forecast.js   upcoming hours, cleanest windows, peak hour
src/advisor.js    explainable recommendation engine
src/api.js        Open-Meteo clients (timeouts, cache, validation)
src/ai.js         grounded prompts; Gemini Nano / Gemini API / fallback
src/app.js        UI controller (DOM-safe rendering)
tests/            node:test suites
```

Data: [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) (CAMS). NAQI breakpoints are from India's CPCB. This app does not give medical advice.

License: MIT
