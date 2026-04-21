import test from "node:test";
import assert from "node:assert/strict";
import {
  createRequestLogger,
  FixedWindowRateLimiter,
  withTimeout,
  retryWithBackoff,
  buildErrorEnvelope,
  fallbackNoResultsResponse,
  runHardenedRecommendationFlow,
} from "../src/reliabilityAndHardening.mjs";

test("rate limiter blocks after threshold", () => {
  const limiter = new FixedWindowRateLimiter({ windowMs: 60_000, maxRequests: 2 });
  assert.equal(limiter.allow("client-1").allowed, true);
  assert.equal(limiter.allow("client-1").allowed, true);
  const third = limiter.allow("client-1");
  assert.equal(third.allowed, false);
  assert.ok(typeof third.retryAfterMs === "number");
});

test("withTimeout throws on timeout", async () => {
  await assert.rejects(
    async () =>
      await withTimeout(
        async () => await new Promise((resolve) => setTimeout(resolve, 60)),
        { timeoutMs: 10 }
      ),
    /timed out/
  );
});

test("retryWithBackoff retries temporary failures", async () => {
  let calls = 0;
  const value = await retryWithBackoff(
    async () => {
      calls += 1;
      if (calls < 3) throw new Error("temporary network issue");
      return 42;
    },
    { retries: 3, initialBackoffMs: 1, shouldRetry: (e) => /temporary/.test(e.message) }
  );
  assert.equal(value, 42);
  assert.equal(calls, 3);
});

test("buildErrorEnvelope returns stable structure", () => {
  const envelope = buildErrorEnvelope({
    code: "X",
    message: "Failed",
    requestId: "req-1",
    retryable: true,
    details: { reason: "timeout" },
  });
  assert.equal(envelope.error.code, "X");
  assert.equal(envelope.error.requestId, "req-1");
  assert.equal(envelope.error.retryable, true);
});

test("fallbackNoResultsResponse returns expected shape", () => {
  const response = fallbackNoResultsResponse({ place: "Banashankari" });
  assert.deepEqual(response.recommendations, []);
  assert.ok(Array.isArray(response.next_actions));
});

test("runHardenedRecommendationFlow returns fallback on empty results", async () => {
  const logger = createRequestLogger();
  const limiter = new FixedWindowRateLimiter({ maxRequests: 5, windowMs: 1000 });
  const res = await runHardenedRecommendationFlow({
    requestId: "req-empty",
    clientId: "client-1",
    preference: { place: "Banashankari" },
    rateLimiter: limiter,
    logger,
    primaryTask: async () => ({ recommendations: [], summary: "" }),
  });
  assert.equal(res.ok, true);
  assert.equal(res.status, 200);
  assert.equal(res.data.recommendations.length, 0);
});

test("runHardenedRecommendationFlow returns 429 when limited", async () => {
  const logger = createRequestLogger();
  const limiter = new FixedWindowRateLimiter({ maxRequests: 1, windowMs: 5000 });

  await runHardenedRecommendationFlow({
    requestId: "req-1",
    clientId: "client-rate",
    preference: {},
    rateLimiter: limiter,
    logger,
    primaryTask: async () => ({ recommendations: [{ name: "X" }] }),
  });

  const second = await runHardenedRecommendationFlow({
    requestId: "req-2",
    clientId: "client-rate",
    preference: {},
    rateLimiter: limiter,
    logger,
    primaryTask: async () => ({ recommendations: [{ name: "X" }] }),
  });

  assert.equal(second.ok, false);
  assert.equal(second.status, 429);
  assert.equal(second.error.code, "RATE_LIMITED");
});

test("runHardenedRecommendationFlow returns 503 on repeated failure", async () => {
  const logger = createRequestLogger();
  const limiter = new FixedWindowRateLimiter({ maxRequests: 5, windowMs: 5000 });
  const res = await runHardenedRecommendationFlow({
    requestId: "req-fail",
    clientId: "client-fail",
    preference: {},
    rateLimiter: limiter,
    logger,
    timeoutMs: 15,
    primaryTask: async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return { recommendations: [{ name: "X" }] };
    },
  });

  assert.equal(res.ok, false);
  assert.equal(res.status, 503);
  assert.equal(res.error.code, "SERVICE_UNAVAILABLE");
});
