# Windows offline edition

This branch builds a local desktop edition. `main` remains the online app.

```sh
npm ci
node desktop/import-seed.mjs /path/to/six/xlsx/exports
npm run check
npm run desktop:package
```

The private `desktop/seed.json` is deliberately ignored by Git. It is copied into
the personal Windows package. Never publish that package or seed in a public release.
The artifact contains personal table data. Builds use the bundled Electron version
from the lockfile and require network access only to download dependencies/runtime.

The package is portable, unsigned Windows x64. Extract and launch `System Builder.exe`.
All runtime modules use Electron or Node built-ins; node_modules is not shipped.
Runtime table data lives in the user's AppData directory, outside the application.
Firestore is accessed only by the manual main-process backup handler.

`tests/desktop.test.cjs` verifies seed counts, local atomic persistence, conflicts,
deletion tombstones, corruption handling and mocked Firestore backup results.
`tests/desktop-ui.cjs` uses a temporary data copy and a headless browser bridge to
exercise the production UI. It makes no Firestore requests. It requires Playwright
Chromium (`npx playwright install chromium`) and a permitted loopback test server.
Windows main-process launch and live Firestore access must be checked on Windows.
