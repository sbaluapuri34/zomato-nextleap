const normalizeCuisineInput = (raw) =>
  String(raw ?? "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) =>
      token
        .split(/\s+/)
        .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
        .join(" ")
    );

export function validatePreferenceInput(input) {
  const errors = [];

  const price = input.price ? Number(input.price) : null;
  const rating = input.rating ? Number(input.rating) : null;
  const place = String(input.place ?? "").trim();
  const cuisines = normalizeCuisineInput(input.cuisine);

  if (price !== null && (!Number.isFinite(price) || price <= 0)) {
    errors.push("Price must be a positive number.");
  }
  if (rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 5)) {
    errors.push("Rating must be between 0 and 5.");
  }

  if (!price && !rating && !place && !cuisines.length) {
    errors.push("Please enter at least one preference.");
  }

  return { valid: errors.length === 0, errors };
}

export function buildPreferencePayload(input) {
  return {
    price: input.price ? Number(input.price) : 0,
    place: String(input.place ?? "").trim(),
    rating: input.rating ? Number(input.rating) : 0,
    cuisine: normalizeCuisineInput(input.cuisine),
  };
}

export function formatRecommendationForCard(rec) {
  return {
    title: rec.name,
    subtitle: `${rec.place} | Rating: ${rec.rating} | Price for two: ${rec.price_for_two}`,
    cuisines: Array.isArray(rec.cuisines) ? rec.cuisines.join(", ") : "",
    reason: rec.reason ?? "",
  };
}

export function dedupeUiRecommendations(recommendations) {
  const seen = new Set();
  const out = [];
  for (const rec of recommendations) {
    const key = `${String(rec.name ?? "").trim().toLowerCase()}|${String(rec.place ?? "")
      .trim()
      .toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(rec);
  }
  return out;
}
