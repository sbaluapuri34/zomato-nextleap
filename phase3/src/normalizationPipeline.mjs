const normalizeText = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

export function parsePrice(raw) {
  if (typeof raw === "number") return Math.trunc(raw);
  const cleaned = String(raw ?? "").replace(/[^\d]/g, "");
  if (!cleaned) throw new Error(`Invalid price: ${raw}`);
  return Number.parseInt(cleaned, 10);
}

export function parseRating(raw) {
  if (typeof raw === "number") {
    if (raw < 0 || raw > 5) throw new Error(`Invalid rating: ${raw}`);
    return raw;
  }
  const match = String(raw ?? "").match(/^\s*([0-5](?:\.\d+)?)\s*(?:\/\s*5)?\s*$/);
  if (!match) throw new Error(`Invalid rating: ${raw}`);
  return Number.parseFloat(match[1]);
}

function toTitleCase(text) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function parseCuisines(raw) {
  const tokens = String(raw ?? "")
    .split(/[,/]/)
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .map(toTitleCase);

  if (!tokens.length) throw new Error(`Invalid cuisines: ${raw}`);
  return [...new Set(tokens)];
}

export function mapSourceRecord(sourceRow) {
  const row = sourceRow?.row ?? sourceRow;
  return {
    name: normalizeText(row.name),
    place: normalizeText(row.location ?? row.place),
    price_for_two: parsePrice(row["approx_cost(for two people)"] ?? row.price ?? row.price_for_two),
    rating: parseRating(row.rate ?? row.rating),
    cuisines: parseCuisines(row.cuisines),
    source: "huggingface",
  };
}

export function validateRestaurant(record) {
  const errors = [];

  if (!record.name) errors.push("name is required");
  if (!record.place) errors.push("place is required");
  if (!Number.isInteger(record.price_for_two) || record.price_for_two < 0) {
    errors.push("price_for_two must be a non-negative integer");
  }
  if (typeof record.rating !== "number" || record.rating < 0 || record.rating > 5) {
    errors.push("rating must be a number between 0 and 5");
  }
  if (!Array.isArray(record.cuisines) || !record.cuisines.length) {
    errors.push("cuisines must be a non-empty array");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function normalizeDataset(rows) {
  const curated = [];
  const rejected = [];

  for (const input of rows) {
    try {
      const normalized = mapSourceRecord(input);
      const validation = validateRestaurant(normalized);
      if (!validation.valid) {
        rejected.push({ input, errors: validation.errors });
        continue;
      }
      curated.push(normalized);
    } catch (error) {
      rejected.push({
        input,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  return {
    curated,
    rejected,
    stats: {
      total: rows.length,
      curated: curated.length,
      rejected: rejected.length,
    },
  };
}
