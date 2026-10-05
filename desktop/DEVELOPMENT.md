# Windows offline edition

This branch builds a local desktop edition. `main` remains the online app.

```sh
npm ci
node desktop/capture-desktop.mjs
npm run check
npm run build -- --outDir build/up-to-date
node desktop/package.mjs up-to-date
# Set SYSTEM_BUILDER_EDITION=pure in the build environment:
npm run build -- --outDir build/pure
node desktop/package.mjs pure
node tests/editions-windows.cjs
python desktop/zip-editions.py
```

The private `desktop/seed.json` is deliberately ignored by Git. It is captured
from the installed desktop database and copied only into the Up-to-Date package.
Never publish that package, seed, or captured profile in a public release.
The Pure Desktop package has empty tables, a separate AppData profile, and no
backup renderer, upload IPC handlers, backup module, or cloud configuration file.
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
`tests/editions-windows.cjs` launches both packaged Windows EXEs in isolated
temporary profiles and verifies empty startup, backup removal, local edits,
habit order persistence, and captured table/preference restoration. Live
Firestore writes are never made by these tests.

