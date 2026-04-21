import { assembleFinalResponse } from "../src/dedupAndResponseAssembler.mjs";

const result = assembleFinalResponse({
  userPreference: {
    price: 1500,
    place: "Banashankari",
    rating: 4.0,
    cuisine: ["North Indian", "Chinese"],
  },
  retrievedCandidates: [{ id: 1 }, { id: 2 }, { id: 3 }],
  llmRecommendations: [
    {
      name: "Jalsa",
      place: "Banashankari",
      price_for_two: 800,
      rating: 4.1,
      cuisines: ["North Indian", "Chinese"],
      reason: "Matches cuisine, budget, and rating preference.",
      match_score: 0.95,
    },
    {
      name: " jalsa ",
      place: " banashankari ",
      price_for_two: "900",
      rating: "4.0",
      cuisines: ["north indian"],
      reason: "Duplicate variant.",
      match_score: 0.9,
    },
    {
      name: "Spice Elephant",
      place: "Banashankari",
      price_for_two: 800,
      rating: 4.1,
      cuisines: ["Chinese", "North Indian", "Thai"],
      reason: "Strong cuisine overlap and good rating.",
      match_score: 0.94,
    },
  ],
  topN: 5,
  includeDebug: true,
});

console.log(JSON.stringify(result, null, 2));
