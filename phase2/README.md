# Phase 3 - Retrieval and Ranking Engine

This phase implements:
- deterministic filtering for `price`, `place`, `rating`, `cuisine`
- candidate ranking using weighted scoring
- top-K shortlist generation for LLM input

## Files
- `phase3/src/retrievalRankingEngine.mjs`
- `phase3/scripts/smoke.mjs`
- `phase3/tests/phase3.test.mjs`

## Testing status
- Automated tests are available for normalization, filtering, and ranking logic.
- A local smoke script is also provided for quick manual validation.

## Run tests
```bash
node --test "phase3/tests/phase3.test.mjs"
```

## Run manual smoke test
```bash
node phase3/scripts/smoke.mjs
```

## Output
The smoke script prints ranked recommendations with:
- normalized fields
- `match_score`
- `score_breakdown` (cuisine/rating/price/place)
