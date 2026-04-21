import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const parsePrice = (raw) => {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) throw new Error("No numeric digits in price");
  return Number.parseInt(digits, 10);
};

const parseRating = (raw) => {
  const match = raw.match(/^\s*([0-5](?:\.\d+)?)\s*(?:\/\s*5)?\s*$/);
  if (!match) throw new Error("Invalid rating format");
  return Number.parseFloat(match[1]);
};

const canonicalizeCuisines = (raw) => {
  const tokens = raw
    .split(/[,/]/)
    .map((t) => t.trim())
    .filter(Boolean);

  const seen = new Set();
  const out = [];
  for (const token of tokens) {
    const normalized = token
      .split(/\s+/)
      .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
    if (!seen.has(normalized)) {
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
};

test("phase0 files exist", () => {
  const expected = [
    path.join(ROOT, "api_contract.json"),
    path.join(ROOT, "dataset_field_mapping.json"),
    path.join(ROOT, "data_quality_acceptance_criteria.md"),
  ];
  for (const filePath of expected) {
    assert.equal(fs.existsSync(filePath), true, `Missing: ${filePath}`);
  }
});

test("api contract has required sections", () => {
  const contract = readJson(path.join(ROOT, "api_contract.json"));
  assert.deepEqual(contract.request_schema.required, [
    "price",
    "place",
    "rating",
    "cuisine",
  ]);
  assert.deepEqual(contract.response_schema.required, [
    "recommendations",
    "summary",
  ]);
});

test("field mapping captures mandatory normalization examples", () => {
  const mapping = readJson(path.join(ROOT, "dataset_field_mapping.json")).mapping;
  assert.equal(mapping.price.example_input, "1,500");
  assert.equal(mapping.price.example_output, 1500);
  assert.equal(mapping.rating.example_input, "4.1/5");
  assert.equal(mapping.rating.example_output, 4.1);
  assert.equal(Array.isArray(mapping.cuisines.example_output), true);
});

test("price normalization rule", () => {
  assert.equal(parsePrice("1,500"), 1500);
  assert.equal(parsePrice("Rs. 2,250"), 2250);
});

test("rating normalization rule", () => {
  assert.equal(parseRating("4.1/5"), 4.1);
  assert.equal(parseRating(" 3.8 "), 3.8);
});

test("cuisine normalization rule", () => {
  assert.deepEqual(
    canonicalizeCuisines("north indian, Chinese / mughlai, Chinese"),
    ["North Indian", "Chinese", "Mughlai"]
  );
});
