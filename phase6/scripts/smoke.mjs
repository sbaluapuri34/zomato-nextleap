import {
  createRequestLogger,
  FixedWindowRateLimiter,
  runHardenedRecommendationFlow,
} from "../src/reliabilityAndHardening.mjs";

const logger = createRequestLogger();
const limiter = new FixedWindowRateLimiter({ maxRequests: 3, windowMs: 60_000 });

const preference = {
  price: 1500,
  place: "Banashankari",
  rating: 4.0,
  cuisine: ["North Indian", "Chinese"],
};

const primaryTask = async () => ({
  recommendations: [
    {
      name: "Jalsa",
      place: "Banashankari",
      price_for_two: 800,
      rating: 4.1,
      cuisines: ["North Indian", "Chinese"],
      reason: "Matches your preference.",
    },
  ],
  summary: "One good recommendation found.",
});

const result = await runHardenedRecommendationFlow({
  requestId: "smoke-req-1",
  clientId: "smoke-client",
  preference,
  rateLimiter: limiter,
  logger,
  primaryTask,
});

console.log(JSON.stringify({ result, logs: logger.events }, null, 2));
