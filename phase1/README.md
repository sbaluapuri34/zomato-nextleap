# Phase 1 - Data Ingestion from Hugging Face API

This phase implements:
- dataset connector for Hugging Face dataset API
- raw snapshot persistence
- ingestion run metadata logging
- retry with exponential backoff for transient failures

## Default dataset
- `ManikaSaini/zomato-restaurant-recommendation`

## Run ingestion
```bash
node phase1/scripts/ingest.mjs
```

Optional env vars:
- `HF_DATASET_ID`
- `PHASE1_OUTPUT_DIR`
- `PHASE1_MAX_ROWS`

## Run tests
```bash
node --test "phase1/tests/phase1.test.mjs"
```
