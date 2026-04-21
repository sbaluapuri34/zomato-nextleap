import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRestaurant,
  normalizePreference,
  filterCandidates,
  rankCandidates,
} from "../src/retrievalRankingEngine.mjs";

test("normalizeRestaurant parses price, rating, and cuisines", () => {
  const normalized = normalizeRestaurant({
    name: "Jalsa",
    location: "Banashankari",
    rate: "4.1/5",
    cuisines: "North Indian, Mughlai, Chinese",
    "approx_cost(for two people)": "1,500",
  });

  assert.equal(normalized.price_for_two, 1500);
  assert.equal(normalized.rating, 4.1);
  assert.deepEqual(normalized.cuisines, ["north indian", "mughlai", "chinese"]);
});

test("normalizePreference canonicalizes place and cuisine", () => {
  const preference = normalizePreference({
    price: 1500,
    place: "  Banashankari ",
    rating: 4,
    cuisine: ["North Indian", "Chinese", "Chinese"],
  });

  assert.equal(preference.place, "banashankari");
  assert.deepEqual(preference.cuisine, ["north indian", "chinese"]);
});

test("filterCandidates applies price/place/rating/cuisine filters", () => {
  const restaurants = [
    {
      name: "Jalsa",
      location: "Banashankari",
      rate: "4.1/5",
      cuisines: "North Indian, Mughlai, Chinese",
      "approx_cost(for two people)": "800",
    },
    {
      name: "San Churro Cafe",
      location: "Banashankari",
      rate: "3.8/5",
      cuisines: "Cafe, Mexican, Italian",
      "approx_cost(for two people)": "800",
    },
    {
      name: "High Budget House",
      location: "Banashankari",
      rate: "4.6/5",
      cuisines: "North Indian",
      "approx_cost(for two people)": "2,500",
    },
  ];

  const preference = {
    price: 1500,
    place: "Banashankari",
    rating: 4.0,
    cuisine: ["North Indian", "Chinese"],
  };

  const filtered = filterCandidates(restaurants, preference);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, "Jalsa");
});

test("rankCandidates returns sorted results with topK", () => {
  const restaurants = [
    {
      name: "Jalsa",
      location: "Banashankari",
      rate: "4.1/5",
      cuisines: "North Indian, Mughlai, Chinese",
      "approx_cost(for two people)": "800",
    },
    {
      name: "Spice Elephant",
      location: "Banashankari",
      rate: "4.1/5",
      cuisines: "Chinese, North Indian, Thai",
      "approx_cost(for two people)": "800",
    },
    {
      name: "Perfect Match",
      location: "Banashankari",
      rate: "4.8/5",
      cuisines: "Chinese, North Indian",
      "approx_cost(for two people)": "900",
    },
  ];

  const preference = {
    price: 1500,
    place: "Banashankari",
    rating: 4.0,
    cuisine: ["North Indian", "Chinese"],
  };

  const ranked = rankCandidates(restaurants, preference, { topK: 2 });
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].name, "Perfect Match");
  assert.ok(ranked[0].match_score >= ranked[1].match_score);
  assert.ok(typeof ranked[0].score_breakdown.cuisineScore === "number");
});
