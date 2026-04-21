import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeDataset } from "../../phase2/src/normalizationPipeline.mjs";
import { rankCandidates } from "../../phase3/src/retrievalRankingEngine.mjs";
import { generateGroqRecommendations } from "../../phase4/src/groqRecommender.mjs";
import { assembleFinalResponse } from "../../phase5/src/dedupAndResponseAssembler.mjs";
import {
  createRequestLogger,
  FixedWindowRateLimiter,
  runHardenedRecommendationFlow,
} from "../../phase6/src/reliabilityAndHardening.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");
const WEB_ROOT = path.resolve(ROOT, "phase7", "web");

const rateLimiter = new FixedWindowRateLimiter({ windowMs: 60000, maxRequests: 50 });
const logger = createRequestLogger();

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.resolve(ROOT, ".env"));
loadEnvFile(path.resolve(ROOT, "phase4", ".env"));

async function loadRestaurants() {
  const runsDir = path.resolve(ROOT, "phase1", "artifacts", "ingestion-runs");
  if (!fs.existsSync(runsDir)) return [];
  const names = (await fsp.readdir(runsDir)).filter((n) => n.endsWith("-raw-snapshot.json"));
  if (!names.length) return [];
  const stats = await Promise.all(
    names.map(async (n) => ({ n, s: await fsp.stat(path.join(runsDir, n)) }))
  );
  stats.sort((a, b) => b.s.mtimeMs - a.s.mtimeMs);
  const latestPath = path.join(runsDir, stats[0].n);
  const snapshot = JSON.parse(await fsp.readFile(latestPath, "utf8"));
  const rows = Array.isArray(snapshot.rows) ? snapshot.rows : [];
  const normalized = normalizeDataset(rows);
  return normalized.curated;
}

function getMetadata(data) {
  const places = new Set();
  const cuisines = new Set();
  const ratings = new Set();
  const prices = new Set();

  data.forEach((r) => {
    if (r.place) places.add(String(r.place).trim());
    if (Array.isArray(r.cuisines)) {
      r.cuisines.forEach((c) => cuisines.add(String(c).trim()));
    }
    if (r.rating) ratings.add(r.rating);
    if (r.price_for_two) prices.add(r.price_for_two);
  });

  return {
    places: Array.from(places).sort(),
    cuisines: Array.from(cuisines).sort(),
    ratings: [3.0, 3.5, 4.0, 4.5, 5.0], // Controlled set for UI suggestions
    prices: [500, 1000, 1500, 2000, 3000], // Common budget steps
  };
}

const restaurants = await loadRestaurants();
const metadata = getMetadata(restaurants);

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function serveStatic(req, res) {
  const reqUrl = req.url === "/" ? "/index.html" : req.url;
  
  let filePath;
  if (reqUrl.startsWith("/src/")) {
    const relativePath = reqUrl.slice(1); // remove leading slash
    filePath = path.join(ROOT, "phase7", relativePath);
  } else {
    const relativePath = reqUrl.slice(1); // remove leading slash
    filePath = path.join(WEB_ROOT, relativePath || "index.html");
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    return res.end(`Not found: ${reqUrl}`);
  }

  const ext = path.extname(filePath);
  const type = ext === ".html" ? "text/html" : ext === ".mjs" ? "text/javascript" : "text/plain";
  res.writeHead(200, { "Content-Type": type });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/recommendations") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const clientId = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "anonymous";

      try {
        const preference = JSON.parse(body);

        const hardenedResult = await runHardenedRecommendationFlow({
          requestId,
          clientId,
          preference,
          rateLimiter,
          logger,
          primaryTask: async () => {
            const ranked = rankCandidates(restaurants, preference, { topK: 20 });
            const apiKey = process.env.GROQ_API_KEY;

            let llmOutput;
            if (apiKey) {
              llmOutput = await generateGroqRecommendations({
                apiKey,
                model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
                preference,
                candidates: ranked,
                topN: 5,
              });
            } else {
              llmOutput = {
                recommendations: ranked.slice(0, 5).map((r) => ({
                  name: r.name,
                  place: r.place,
                  price_for_two: r.price_for_two,
                  rating: r.rating,
                  cuisines: r.cuisines,
                  reason: "Matched by deterministic ranking (Groq key not configured).",
                  match_score: r.match_score,
                })),
                summary: "Fallback recommendations returned without Groq.",
              };
            }

            return assembleFinalResponse({
              userPreference: preference,
              retrievedCandidates: ranked,
              llmRecommendations: llmOutput.recommendations,
              topN: 5,
            });
          },
        });

        if (!hardenedResult.ok) {
          return sendJson(res, hardenedResult.status, hardenedResult);
        }

        return sendJson(res, 200, hardenedResult.data);
      } catch (error) {
        return sendJson(res, 500, { error: String(error?.message ?? error) });
      }
    });
    return;
  }

  if (req.method === "GET") {
    if (req.url === "/metadata") return sendJson(res, 200, metadata);
    return serveStatic(req, res);
  }
  res.writeHead(405);
  res.end("Method Not Allowed");
});

const port = Number(process.env.PHASE7_PORT || 3000);
server.listen(port, () => {
  console.log(`Phase 7 manual test server running: http://localhost:${port}`);
  console.log(`Loaded curated restaurants: ${restaurants.length}`);
  console.log(`Hardened flow enabled with Phase 6 logic.`);
});
