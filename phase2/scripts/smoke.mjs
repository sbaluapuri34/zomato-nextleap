import { normalizeDataset } from "../src/normalizationPipeline.mjs";

const sampleRows = [
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
      name: "Bad Record",
      location: "Banashankari",
      rate: "6.5/5",
      cuisines: "",
      "approx_cost(for two people)": "abc",
    },
  },
];

const result = normalizeDataset(sampleRows);
console.log(JSON.stringify(result, null, 2));
