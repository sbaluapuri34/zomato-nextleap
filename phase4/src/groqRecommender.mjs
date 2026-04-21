const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export function buildRecommendationPrompt({ preference, candidates, topN = 5 }) {
  const safeCandidates = candidates.slice(0, 30).map((c, idx) => ({
    rank_input: idx + 1,
    name: c.name,
    place: c.place,
    price_for_two: c.price_for_two,
    rating: c.rating,
    cuisines: c.cuisines,
    match_score: c.match_score,
  }));

  return {
    system: [
      "You are a restaurant recommendation assistant.",
      "Only use the provided candidate data. Do not invent restaurants or attributes.",
      "Return strict JSON only. No markdown.",
      "Ensure recommendations are unique by restaurant name + place.",
      "Be concise and clear.",
    ].join(" "),
    user: JSON.stringify(
      {
        task: "Generate clear restaurant recommendations grounded in candidate data.",
        output_schema: {
          recommendations: [
            {
              name: "string",
              place: "string",
              price_for_two: "number",
              rating: "number",
              cuisines: ["string"],
              reason: "string",
            },
          ],
          summary: "string",
        },
        constraints: [
          `Return at most ${topN} recommendations`,
          "No duplicates in recommendations",
          "Keep reasons factual and based on provided fields only",
        ],
        preference,
        candidates: safeCandidates,
      },
      null,
      2
    ),
  };
}

export async function callGroqChat({
  apiKey,
  model = "llama-3.3-70b-versatile",
  prompt,
  temperature = 0.2,
  maxCompletionTokens = 1000,
  fetchImpl = fetch,
}) {
  if (!apiKey) {
    throw new Error("Missing Groq API key");
  }

  const response = await fetchImpl(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      max_completion_tokens: maxCompletionTokens,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error ${response.status}: ${errorText}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq response did not include message content");
  }
  return content;
}

export function parseRecommendationJson(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error("LLM output is not valid JSON");
  }

  const recs = parsed?.recommendations;
  const summary = parsed?.summary;

  if (!Array.isArray(recs)) {
    throw new Error("LLM output missing recommendations array");
  }
  if (typeof summary !== "string" || !summary.trim()) {
    throw new Error("LLM output missing summary");
  }

  for (const rec of recs) {
    if (!rec?.name || !rec?.place || !rec?.reason) {
      throw new Error("Recommendation item missing required fields");
    }
    if (typeof rec.price_for_two !== "number") {
      throw new Error("Recommendation price_for_two must be a number");
    }
    if (typeof rec.rating !== "number") {
      throw new Error("Recommendation rating must be a number");
    }
    if (!Array.isArray(rec.cuisines)) {
      throw new Error("Recommendation cuisines must be an array");
    }
  }

  return parsed;
}

export function dedupeRecommendations(recommendations) {
  const seen = new Set();
  const out = [];

  for (const rec of recommendations) {
    const key = `${String(rec.name).trim().toLowerCase()}|${String(rec.place)
      .trim()
      .toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(rec);
    }
  }
  return out;
}

export async function generateGroqRecommendations({
  apiKey,
  model,
  preference,
  candidates,
  topN = 5,
  fetchImpl = fetch,
}) {
  const prompt = buildRecommendationPrompt({ preference, candidates, topN });
  const raw = await callGroqChat({
    apiKey,
    model,
    prompt,
    fetchImpl,
  });
  const parsed = parseRecommendationJson(raw);
  return {
    recommendations: dedupeRecommendations(parsed.recommendations).slice(0, topN),
    summary: parsed.summary,
    metadata: {
      provider: "groq",
      model: model ?? "llama-3.3-70b-versatile",
      requestedTopN: topN,
    },
  };
}
