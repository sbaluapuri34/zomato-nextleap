import test from "node:test";
import assert from "node:assert/strict";
import {
  getPrimaryDedupKey,
  dedupeRecommendations,
  normalizeRecommendation,
  sortRecommendations,
  assembleFinalResponse,
} from "../src/dedupAndResponseAssembler.mjs";

test("primary dedup key normalizes name and place", () => {
  const key = getPrimaryDedupKey({
    name: "  Jalsa ",
    place: "BANASHANKARI ",
  });
  assert.equal(key, "jalsa|banashankari");
});

test("dedupeRecommendations removes duplicates by name + place", () => {
  const input = [
    { name: "Jalsa", place: "Banashankari", price_for_two: 800, rating: 4.1, cuisines: ["North Indian"], reason: "A" },
    { name: " jalsa ", place: " banashankari ", price_for_two: 900, rating: 4.0, cuisines: ["Chinese"], reason: "B" },
    { name: "Spice Elephant", place: "Banashankari", price_for_two: 800, rating: 4.1, cuisines: ["Chinese"], reason: "C" },
  ];
  const out = dedupeRecommendations(input);
  assert.equal(out.length, 2);
});

test("normalizeRecommendation parses values correctly", () => {
  const normalized = normalizeRecommendation({
    name: "Spice Elephant",
    place: "Banashankari",
    price_for_two: "1,500",
    rating: "4.1",
    cuisines: ["north indian", "Chinese", "north indian"],
    reason: "Good match",
    match_score: 0.91,
  });

  assert.equal(normalized.price_for_two, 1500);
  assert.equal(normalized.rating, 4.1);
  assert.deepEqual(normalized.cuisines, ["North Indian", "Chinese"]);
});

test("sortRecommendations sorts by score then rating then price", () => {
  const sorted = sortRecommendations([
    { name: "A", place: "X", price_for_two: 900, rating: 4.2, cuisines: [], reason: "", match_score: 0.9 },
    { name: "B", place: "X", price_for_two: 700, rating: 4.6, cuisines: [], reason: "", match_score: 0.9 },
    { name: "C", place: "X", price_for_two: 500, rating: 4.0, cuisines: [], reason: "", match_score: 0.8 },
  ]);
  assert.equal(sorted[0].name, "B");
  assert.equal(sorted[1].name, "A");
  assert.equal(sorted[2].name, "C");
});

test("assembleFinalResponse dedupes, ranks, truncates, and formats output", () => {
  const response = assembleFinalResponse({
    userPreference: {
      price: 1500,
      place: "Banashankari",
      rating: 4.0,
      cuisine: ["North Indian", "Chinese"],
    },
    retrievedCandidates: [{}, {}, {}],
    llmRecommendations: [
      {
        name: "Jalsa",
        place: "Banashankari",
        price_for_two: 800,
        rating: 4.1,
        cuisines: ["North Indian", "Chinese"],
        reason: "Great fit",
        match_score: 0.95,
      },
      {
        name: "Jalsa",
        place: "Banashankari",
        price_for_two: 900,
        rating: 4.0,
        cuisines: ["North Indian"],
        reason: "Duplicate",
        match_score: 0.9,
      },
      {
        name: "Spice Elephant",
        place: "Banashankari",
        price_for_two: 800,
        rating: 4.1,
        cuisines: ["Chinese", "North Indian"],
        reason: "Great fit",
        match_score: 0.94,
      },
    ],
    topN: 1,
    includeDebug: true,
  });

  assert.equal(response.recommendations.length, 1);
  assert.equal(response.recommendations[0].name, "Jalsa");
  assert.ok(response.summary.includes("Found 1"));
  assert.equal(response.debug.outputCounts.deduped, 2);
});
