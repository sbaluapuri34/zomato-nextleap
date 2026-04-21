const normalizeText = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const normalizeCuisine = (value) =>
  String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

export function getPrimaryDedupKey(record) {
  const name = normalizeText(record?.name);
  const place = normalizeText(record?.place);
  return `${name}|${place}`;
}

export function getFallbackDedupKey(record) {
  const name = normalizeText(record?.name);
  const place = normalizeText(record?.place);
  const price = Number(record?.price_for_two ?? 0);
  const rating = Number(record?.rating ?? 0);
  const cuisines = Array.isArray(record?.cuisines)
    ? [...record.cuisines].map(normalizeText).sort().join(",")
    : "";
  return `${name}|${place}|${price}|${rating}|${cuisines}`;
}

export function dedupeRecommendations(records) {
  const seenPrimary = new Set();
  const seenFallback = new Set();
  const out = [];

  for (const record of records) {
    const primary = getPrimaryDedupKey(record);
    const fallback = getFallbackDedupKey(record);
    if (seenPrimary.has(primary) || seenFallback.has(fallback)) {
      continue;
    }
    seenPrimary.add(primary);
    seenFallback.add(fallback);
    out.push(record);
  }
  return out;
}

export function normalizeRecommendation(record) {
  return {
    name: String(record?.name ?? "").trim(),
    place: String(record?.place ?? "").trim(),
    price_for_two: Number.parseInt(String(record?.price_for_two ?? "0").replace(/[^\d]/g, ""), 10) || 0,
    rating: Number.parseFloat(String(record?.rating ?? 0)) || 0,
    cuisines: Array.isArray(record?.cuisines)
      ? [...new Set(record.cuisines.map(normalizeCuisine).filter(Boolean))]
      : [],
    reason: String(record?.reason ?? "").trim(),
    match_score: typeof record?.match_score === "number" ? record.match_score : 0,
  };
}

export function sortRecommendations(records) {
  return [...records].sort((a, b) => {
    if (b.match_score !== a.match_score) return b.match_score - a.match_score;
    if (b.rating !== a.rating) return b.rating - a.rating;
    return a.price_for_two - b.price_for_two;
  });
}

export function assembleFinalResponse({
  userPreference,
  retrievedCandidates = [],
  llmRecommendations = [],
  topN = 5,
  includeDebug = false,
}) {
  const normalized = llmRecommendations.map(normalizeRecommendation);
  const deduped = dedupeRecommendations(normalized);
  const sorted = sortRecommendations(deduped).slice(0, topN);

  const summary =
    sorted.length > 0
      ? `Found ${sorted.length} recommendation(s) matching your preferences.`
      : "No exact matches found. Try relaxing price, rating, or cuisine filters.";

  const response = {
    recommendations: sorted.map(({ match_score, ...rest }) => rest),
    summary,
  };

  if (includeDebug) {
    response.debug = {
      inputCounts: {
        retrievedCandidates: retrievedCandidates.length,
        llmRecommendations: llmRecommendations.length,
      },
      outputCounts: {
        deduped: deduped.length,
        returned: response.recommendations.length,
      },
      userPreference,
    };
  }

  return response;
}
