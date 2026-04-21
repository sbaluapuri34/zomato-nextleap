# Phase 0 Acceptance Criteria

## Contract and Documentation
- API request schema requires: `price`, `place`, `rating`, `cuisine`.
- API response schema requires: `recommendations`, `summary`.
- Field mapping document exists for source-to-target transformation.

## Mandatory Data Normalization Rules
1. Price is stored as integer without commas.
   - Example: `1,500` -> `1500`
2. Rating is stored as float without denominator.
   - Example: `4.1/5` -> `4.1`
3. Cuisines are stored as canonical array of strings.
   - Trim spaces, normalize casing, remove duplicates.
4. Duplicate restaurants are removed from final recommendation output.

## Duplicate Detection Definition
- Primary key: normalized `(name, place)`.
- Fallback key: hash of `(name, place, price_for_two, rating, cuisines)`.

## Exit Criteria for Phase 0
- Contract docs are present and versioned.
- Normalization examples are captured in field mapping.
- Acceptance criteria explicitly include de-duplication behavior.
- Automated tests for Phase 0 artifacts pass.
