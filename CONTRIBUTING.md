# Contributing

```bash
npm install        # dev tools only (ESLint, TypeScript); the app has no runtime dependencies
npm run check      # lint + strict type check + tests
python3 -m http.server   # serve locally at http://localhost:8000
```

- Add advice as a new rule in `src/rules/*.js` and register it in that module's exported list, with a test.
- Put tunable numbers in `src/config.js`, not inline.
- Keep logic pure and DOM-free outside `src/ui/` and `src/main.js`.
- Render text only through `el()` in `src/ui/dom.js` (never `innerHTML`).
- CI enforces complexity ≤ 10, functions ≤ 60 lines and files ≤ 250 lines.
