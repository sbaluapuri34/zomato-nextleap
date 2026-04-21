import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateGroqRecommendations } from "../src/groqRecommender.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseEnvFile(content) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

// Dotenv-compatible auto loading without requiring manual env export.
// Priority: existing process env > phase4/.env > project-root/.env
for (const envPath of [
  path.resolve(__dirname, "..", ".env"),
  path.resolve(process.cwd(), ".env"),
]) {
  if (fs.existsSync(envPath)) {
    parseEnvFile(fs.readFileSync(envPath, "utf8"));
  }
}

const apiKey = process.env.GROQ_API_KEY;
const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const preference = {
  price: 1500,
  place: "Banashankari",
  rating: 4.0,
  cuisine: ["North Indian", "Chinese"],
};

const candidates = [
  {
    name: "Jalsa",
    place: "Banashankari",
    price_for_two: 800,
    rating: 4.1,
    cuisines: ["North Indian", "Mughlai", "Chinese"],
    match_score: 0.946,
  },
  {
    name: "Spice Elephant",
    place: "Banashankari",
    price_for_two: 800,
    rating: 4.1,
    cuisines: ["Chinese", "North Indian", "Thai"],
    match_score: 0.946,
  },
  {
    name: "San Churro Cafe",
    place: "Banashankari",
    price_for_two: 800,
    rating: 3.8,
    cuisines: ["Cafe", "Mexican", "Italian"],
    match_score: 0.62,
  },
];

async function main() {
  const result = await generateGroqRecommendations({
    apiKey,
    model,
    preference,
    candidates,
    topN: 2,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("Phase 4 run failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
