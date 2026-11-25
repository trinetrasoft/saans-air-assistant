# Architecture

Saans is a static single-page app. The design goal is a **pure core and a thin UI**: everything that decides *what* to show is plain functions with no DOM access, so it is unit-tested; the UI layer only reads the form and paints results.

```
            ┌──────────── src/main.js (events, state) ────────────┐
            │                                                      │
   src/api.js ── Open-Meteo ──► src/analysis.js (pure pipeline) ──► src/ui/render.js
   (timeouts, bounded cache)      │                                 src/ui/form.js
                                  ├─ aqi.js       NAQI (CPCB)       src/ui/dom.js
                                  ├─ forecast.js  cleanest windows
                                  ├─ impact.js    inhaled dose, GRAP
                                  ├─ advisor.js ─► rules/{health,routine,indoor,sustainable}.js
                                  └─ ai/prompt.js grounding context
   src/ai.js ── providers (on-device Gemini Nano → Gemini API → rules) with timeouts
   src/config.js  every endpoint, limit and threshold      src/types.js  shared JSDoc types
```

## Key decisions

- **Rules, not a monolith.** Each recommendation is an independent `Rule` (`ctx → Rec | null`) in a themed module. The advisor builds one `RuleContext` (unhealthy/hazardous flags, cleanest window, quantified outing), runs every rule, then sorts by priority. New advice = a new rule. The rule list is injectable for testing.
- **Deterministic first, generative second.** The plan is computed deterministically and tested. The language model receives that plan as "vetted actions" and personalises and explains it, so it cannot invent the data or contradict the safety guidance.
- **Configuration in one place.** `src/config.js` holds every endpoint, timeout, cache size, forecast setting and NAQI threshold.
- **Types without a build.** Every module is `// @ts-check` with JSDoc types and is checked with `tsc --strict` in CI. No transpilation, so the deployed files are exactly the source files.
- **Safe rendering.** `ui/dom.js` exposes `el()`, which only uses `textContent`. ESLint forbids `eval`-like constructs, and the CSP blocks inline script.
