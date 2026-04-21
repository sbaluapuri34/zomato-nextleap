const normalizeText = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const normalizeCuisineToken = (value) =>
  normalizeText(value)
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");

const toCuisineArray = (cuisines) => {
  if (Array.isArray(cuisines)) {
    return cuisines.map(normalizeCuisineToken).filter(Boolean);
  }
  return String(cuisines ?? "")
    .split(/[,/]/)
    .map(normalizeCuisineToken)
    .filter(Boolean);
};

const dedupeCuisineArray = (cuisines) => [...new Set(cuisines)];

const parsePrice = (value) => {
  if (typeof value === "number") return Math.trunc(value);
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  return digits ? Number.parseInt(digits, 10) : 0;
};

const parseRating = (value) => {
  if (typeof value === "number") return value;
  const match = String(value ?? "").match(/([0-5](?:\.\d+)?)/);
  return match ? Number.parseFloat(match[1]) : 0;
};

export function normalizeRestaurant(raw) {
  return {
    id: raw.id ?? null,
    name: String(raw.name ?? "").trim(),
    place: String(raw.place ?? raw.location ?? "").trim(),
    price_for_two: parsePrice(raw.price_for_two ?? raw.price ?? raw["approx_cost(for two people)"]),
    rating: parseRating(raw.rating ?? raw.rate),
    cuisines: dedupeCuisineArray(toCuisineArray(raw.cuisines)),
    source: raw.source ?? "dataset",
  };
}

export function normalizePreference(preference) {
  return {
    price: Number(preference?.price ?? 0),
    place: normalizeText(preference?.place),
    rating: Number(preference?.rating ?? 0),
    cuisine: dedupeCuisineArray(toCuisineArray(preference?.cuisine ?? [])),
  };
}

function computeCuisineScore(candidateCuisines, preferredCuisines) {
  if (!preferredCuisines.length) return 0;
  const candidateSet = new Set(candidateCuisines);
  let overlap = 0;
  for (const pref of preferredCuisines) {
    if (candidateSet.has(pref)) overlap += 1;
  }
  return overlap / preferredCuisines.length;
}

function computePriceScore(candidatePrice, preferredPrice) {
  if (!preferredPrice || candidatePrice <= preferredPrice) return 1;
  const delta = candidatePrice - preferredPrice;
  return Math.max(0, 1 - delta / Math.max(preferredPrice, 1));
}

function computeRatingScore(candidateRating, preferredRating) {
  if (!preferredRating) return candidateRating / 5;
  if (candidateRating < preferredRating) return 0;
  return Math.min(1, candidateRating / 5);
}

export function filterCandidates(restaurants, preference) {
  const pref = normalizePreference(preference);
  return restaurants
    .map(normalizeRestaurant)
    .filter((r) => {
      const placeOk = !pref.place || normalizeText(r.place).includes(pref.place);
      const priceOk = !pref.price || r.price_for_two <= pref.price;
      const ratingOk = !pref.rating || r.rating >= pref.rating;
      const cuisineOk =
        !pref.cuisine.length ||
        pref.cuisine.some((c) => r.cuisines.includes(c));
      return placeOk && priceOk && ratingOk && cuisineOk;
    });
}

export function rankCandidates(restaurants, preference, options = {}) {
  const pref = normalizePreference(preference);
  const {
    cuisineWeight = 0.4,
    ratingWeight = 0.3,
    priceWeight = 0.2,
    placeWeight = 0.1,
    topK = 20,
  } = options;

  const filtered = filterCandidates(restaurants, pref);
  const ranked = filtered.map((r) => {
    const cuisineScore = computeCuisineScore(r.cuisines, pref.cuisine);
    const ratingScore = computeRatingScore(r.rating, pref.rating);
    const priceScore = computePriceScore(r.price_for_two, pref.price);
    const placeScore = !pref.place
      ? 1
      : normalizeText(r.place).includes(pref.place)
      ? 1
      : 0;

    const match_score =
      cuisineScore * cuisineWeight +
      ratingScore * ratingWeight +
      priceScore * priceWeight +
      placeScore * placeWeight;

    return {
      ...r,
      score_breakdown: {
        cuisineScore,
        ratingScore,
        priceScore,
        placeScore,
      },
      match_score: Number(match_score.toFixed(4)),
    };
  });

  return ranked.sort((a, b) => b.match_score - a.match_score).slice(0, topK);
}
