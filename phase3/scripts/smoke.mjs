import { rankCandidates } from "../src/retrievalRankingEngine.mjs";

const sampleRestaurants = [
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

const ranked = rankCandidates(sampleRestaurants, preference, { topK: 10 });
console.log(JSON.stringify({ preference, recommendations: ranked }, null, 2));
