# Phase 2 - Data Normalization and Validation

This phase implements:
- source-to-curated schema mapping
- price normalization (`1,500` -> `1500`)
- rating normalization (`4.1/5` -> `4.1`)
- cuisine canonicalization and deduplication
- schema validation and bad-record rejection

## Files
- `phase2/src/normalizationPipeline.mjs`
- `phase2/tests/phase2.test.mjs`
- `phase2/scripts/smoke.mjs`

## Run tests
```bash
node --test "phase2/tests/phase2.test.mjs"
```

## Run smoke check
```bash
node phase2/scripts/smoke.mjs
```
