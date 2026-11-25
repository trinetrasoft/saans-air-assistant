# Security

Saans is a static, client-only web app with **no backend and no runtime dependencies**.

| Risk | Mitigation |
|---|---|
| Cross-site scripting | All dynamic content is rendered with `textContent` / DOM APIs; there is no `innerHTML`, `eval` or `new Function` (enforced by ESLint). A strict Content-Security-Policy allows scripts and styles from the same origin only. |
| Data exfiltration | The CSP `connect-src` allows only Open-Meteo (geocoding and air quality) and Google's Gemini API. `base-uri`, `form-action` and `object-src` are `none`. `Referrer-Policy: no-referrer`. |
| API key handling | The optional Gemini key is entered by the user, kept in memory for the tab only, sent only in the `x-goog-api-key` header (never in a URL), and never logged or persisted. No keys are committed to this repository. |
| Untrusted input | Questions are stripped of control characters and capped at 500 characters. Place names are capped at 80 characters. Coordinates are range-checked. The stored profile is re-validated against an allow-list on load. |
| Prompt injection | The system instruction pins the assistant to air-quality topics and forbids diagnoses. Model output is shown as plain text only. |
| Availability | Network calls time out after 10 s and model calls after 60 s; failures fall back to the built-in guidance engine. |
| Privacy | The household profile stays in `localStorage` on the device. Location is used only to query air quality. On-device Gemini Nano keeps questions on the device. |

Report issues via GitHub issues on this repository.
