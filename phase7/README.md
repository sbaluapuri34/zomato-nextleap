# Phase 7 - UI Page and End-User Experience

This phase implements:
- a UI page for collecting preference inputs (`price`, `place`, `rating`, `cuisine`)
- API call to recommendation endpoint
- loading, error, and empty states
- recommendation card rendering
- duplicate removal in UI rendering

## Files
- `phase7/web/index.html`
- `phase7/web/uiPage.mjs`
- `phase7/src/uiLogic.mjs`
- `phase7/tests/phase7.test.mjs`
- `phase7/scripts/smoke.mjs`

## Run tests
```bash
node --test "phase7/tests/phase7.test.mjs"
```

## Run smoke check
```bash
node phase7/scripts/smoke.mjs
```

## Open UI page
Open `phase7/web/index.html` in a browser.
By default, API base URL is `http://localhost:3000` and expects:
- `POST /recommendations`
