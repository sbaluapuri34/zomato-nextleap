# Phase 4 - Groq LLM Recommendation Generation

This phase implements:
- Groq LLM integration for recommendation generation
- grounded prompt creation from user preference + ranked candidates
- strict JSON response parsing and validation
- final recommendation de-duplication (`name + place`)

## Folder structure
- `phase4/src/groqRecommender.mjs`
- `phase4/scripts/runGroq.mjs`

## Environment
Set:
- `GROQ_API_KEY` (required)
- `GROQ_MODEL` (optional, default: `llama-3.3-70b-versatile`)

## Run
```bash
node phase4/scripts/runGroq.mjs
```

## Note on tests
As requested, test cases for this phase are deferred until Groq API key is connected.
Once connected, we will add:
- unit tests for prompt builder / parser / dedupe
- integration tests for Groq API response handling
