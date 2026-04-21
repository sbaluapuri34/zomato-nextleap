import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePrice,
  parseRating,
  parseCuisines,
  mapSourceRecord,
  validateRestaurant,
  normalizeDataset,
} from "../src/normalizationPipeline.mjs";

test("parsePrice normalizes comma separated values", () => {
  assert.equal(parsePrice("1,500"), 1500);
  assert.equal(parsePrice("Rs. 2,250"), 2250);
});

test("parseRating normalizes slash ratings", () => {
  assert.equal(parseRating("4.1/5"), 4.1);
  assert.equal(parseRating(" 3.8 "), 3.8);
});

test("parseCuisines returns canonical unique list", () => {
  assert.deepEqual(
    parseCuisines("north indian, Chinese / mughlai, chinese"),
    ["North Indian", "Chinese", "Mughlai"]
  );
});

test("mapSourceRecord maps from HF row shape", () => {
  const mapped = mapSourceRecord({
    row: {
      name: "Jalsa",
      location: "Banashankari",
      rate: "4.1/5",
      cuisines: "North Indian, Mughlai, Chinese",
      "approx_cost(for two people)": "1,500",
    },
  });

  assert.equal(mapped.price_for_two, 1500);
  assert.equal(mapped.rating, 4.1);
  assert.deepEqual(mapped.cuisines, ["North Indian", "Mughlai", "Chinese"]);
});

test("validateRestaurant rejects bad schema", () => {
  const bad = {
    name: "",
    place: "",
    price_for_two: -1,
    rating: 9,
    cuisines: [],
  };
  const validation = validateRestaurant(bad);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.length >= 4);
});

test("normalizeDataset splits curated and rejected", () => {
  const rows = [
    {
      row: {
        name: "Jalsa",
        location: "Banashankari",
        rate: "4.1/5",
        cuisines: "North Indian, Mughlai, Chinese",
        "approx_cost(for two people)": "1,500",
      },
    },
    {
      row: {
        name: "Bad",
        location: "Banashankari",
        rate: "6.1/5",
        cuisines: "",
        "approx_cost(for two people)": "abc",
      },
    },
  ];

  const result = normalizeDataset(rows);
  assert.equal(result.stats.total, 2);
  assert.equal(result.stats.curated, 1);
  assert.equal(result.stats.rejected, 1);
  assert.equal(result.curated[0].price_for_two, 1500);
  assert.equal(result.curated[0].rating, 4.1);
});
