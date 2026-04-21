import {
  validatePreferenceInput,
  buildPreferencePayload,
  dedupeUiRecommendations,
} from "../src/uiLogic.mjs";

const formInput = {
  price: "1500",
  place: "Banashankari",
  rating: "4.0",
  cuisine: "North Indian, Chinese",
};

const validation = validatePreferenceInput(formInput);
if (!validation.valid) {
  console.error("Validation failed", validation.errors);
  process.exit(1);
}

const payload = buildPreferencePayload(formInput);
const recs = dedupeUiRecommendations([
  { name: "Jalsa", place: "Banashankari" },
  { name: " jalsa ", place: " banashankari " },
  { name: "Spice Elephant", place: "Banashankari" },
]);

console.log(
  JSON.stringify(
    {
      payload,
      dedupedCount: recs.length,
      status: "phase7-smoke-pass",
    },
    null,
    2
  )
);
