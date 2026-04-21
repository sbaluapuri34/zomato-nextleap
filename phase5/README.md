# Phase 5 - De-duplication and Response Assembly

This phase implements:
- duplicate detection and removal for recommendations
- final ranking and response formatting
- optional debug payload for traceability

## Files
- `phase5/src/dedupAndResponseAssembler.mjs`
- `phase5/tests/phase5.test.mjs`
- `phase5/scripts/smoke.mjs`

## Rules implemented
- Primary dedupe key: normalized `name + place`
- Fallback dedupe key: normalized `(name, place, price_for_two, rating, cuisines)`
- Final ordering: `match_score DESC`, then `rating DESC`, then `price_for_two ASC`

## Run tests
```bash
node --test "phase5/tests/phase5.test.mjs"
```

## Run smoke check
```bash
node phase5/scripts/smoke.mjs
```
