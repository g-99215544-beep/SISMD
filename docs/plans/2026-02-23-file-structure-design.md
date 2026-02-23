# SisMD File Structure Redesign

**Date:** 2026-02-23
**Status:** Approved
**Approach:** Vite + Vanilla JS (Option A)

## Problem

The entire app lives in a single 1,290-line `index.html` file — ~337 lines of CSS, ~300 lines of HTML markup, and ~651 lines of JavaScript all mixed together. This makes the code difficult to navigate, maintain, and test.

## Goals

1. Split the monolith into focused, single-responsibility source files
2. Fix the three security issues identified in the code review (XSS, IC validation, ID generation)
3. Preserve the single-file portable output (`dist/index.html`) for distribution
4. Introduce Vite as the build tool and dev server

## Architecture

### Stack

- **Bundler:** Vite (produces `dist/index.html` as a self-contained single file)
- **Language:** Vanilla JS (ES modules) — no framework
- **Fonts:** Kept as Google Fonts CDN links (acceptable trade-off for now)

### Source Layout

```
sismd/
├── index.html              ← HTML shell (nav + page divs, no inline CSS/JS)
├── vite.config.js          ← inline plugin to bundle to single file
├── package.json
├── src/
│   ├── main.js             ← init(), nav routing, page switching
│   ├── style.css           ← all CSS extracted verbatim
│   ├── store.js            ← shared state: murid[], rekod[], larian{}
│   │                          save()/load() with QuotaExceededError guard
│   └── modules/
│       ├── utils.js        ← fDur(), esc(), dl(), showToast()
│       ├── register.js     ← CSV import, wizard, participant table, IC validation
│       ├── timer.js        ← race start/stop, interval, page visibility handler
│       ├── scanner.js      ← manual scan, camera, AI path, stopCam on unload
│       └── leaderboard.js  ← renderLB(), semakSekolah(), CSV exports
└── docs/
    └── plans/
        └── 2026-02-23-file-structure-design.md
```

### State Management

State lives in a plain mutable object in `store.js`. No reactivity library. Existing render functions already do full re-renders on change — this pattern is preserved.

```js
// store.js
export const state = { murid: [], rekod: [], larian: {} };
export function save() { ... }  // with QuotaExceededError guard
export function load() { ... }
```

### Build Output

`npm run build` produces `dist/index.html` — a single self-contained file identical in behaviour to today's `index.html`, suitable for copying to a USB stick or hosting as a static file.

### Dev Server

Vite dev server on port 5173 with HMR. `launch.json` updated accordingly.

## Security Fixes (included in restructure)

| Issue | Fix |
|-------|-----|
| Stored XSS via `innerHTML` | Add `esc(s)` helper in `utils.js`; apply to all CSV-derived values in template literals |
| No IC number validation | Reject rows where `ic.replace(/[^0-9]/g,'').length !== 12`; surface error count in import summary |
| Fragile `Date.now()+Math.random()` IDs | Replace with `crypto.randomUUID()` |

## Out of Scope

- No framework migration
- No test suite (separate concern)
- No CSP meta tag (depends on removing inline `onclick` handlers — future work)
- No camera/AI proxy fix (separate concern)
- No font bundling

## Success Criteria

- `npm run dev` starts Vite dev server, app works identically to current version
- `npm run build` produces a single `dist/index.html` that works standalone
- Each source file has a single clear responsibility
- No `innerHTML` interpolation of unsanitised user data remains
- All IC numbers validated to 12 digits on import
