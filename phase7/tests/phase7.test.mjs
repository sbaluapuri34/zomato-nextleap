import test from "node:test";
import assert from "node:assert/strict";
import {
  validatePreferenceInput,
  buildPreferencePayload,
  formatRecommendationForCard,
  dedupeUiRecommendations,
} from "../src/uiLogic.mjs";

test("validatePreferenceInput catches invalid input", () => {
  const result = validatePreferenceInput({
    price: -5,
    place: "",
    rating: 8,
    cuisine: "",
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 3);
});

test("buildPreferencePayload normalizes input", () => {
  const payload = buildPreferencePayload({
    price: "1500",
    place: " Banashankari ",
    rating: "4.1",
    cuisine: "north indian, chinese, north indian",
  });
  assert.equal(payload.price, 1500);
  assert.equal(payload.place, "Banashankari");
  assert.equal(payload.rating, 4.1);
  assert.deepEqual(payload.cuisine, ["North Indian", "Chinese", "North Indian"]);
});

test("formatRecommendationForCard maps fields for display", () => {
  const card = formatRecommendationForCard({
    name: "Jalsa",
    place: "Banashankari",
    rating: 4.1,
    price_for_two: 800,
    cuisines: ["North Indian", "Chinese"],
    reason: "Great fit",
  });
  assert.equal(card.title, "Jalsa");
  assert.ok(card.subtitle.includes("Banashankari"));
  assert.equal(card.cuisines, "North Indian, Chinese");
});

test("dedupeUiRecommendations removes duplicates by name + place", () => {
  const deduped = dedupeUiRecommendations([
    { name: "Jalsa", place: "Banashankari" },
    { name: " jalsa ", place: " banashankari " },
    { name: "Spice Elephant", place: "Banashankari" },
  ]);
  assert.equal(deduped.length, 2);
});
