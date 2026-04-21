export function createRequestLogger() {
  const events = [];
  return {
    info(message, meta = {}) {
      events.push({
        level: "info",
        message,
        meta,
        ts: new Date().toISOString(),
      });
    },
    error(message, meta = {}) {
      events.push({
        level: "error",
        message,
        meta,
        ts: new Date().toISOString(),
      });
    },
    events,
  };
}

export class FixedWindowRateLimiter {
  constructor({ windowMs = 60_000, maxRequests = 30 } = {}) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.buckets = new Map();
  }

  allow(key) {
    const now = Date.now();
    const entry = this.buckets.get(key);
    if (!entry || now >= entry.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.maxRequests - 1 };
    }
    if (entry.count >= this.maxRequests) {
      return { allowed: false, retryAfterMs: Math.max(0, entry.resetAt - now) };
    }
    entry.count += 1;
    return { allowed: true, remaining: this.maxRequests - entry.count };
  }
}

export async function withTimeout(taskFn, { timeoutMs = 8000 } = {}) {
  return await Promise.race([
    taskFn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

export async function retryWithBackoff(
  taskFn,
  { retries = 2, initialBackoffMs = 250, shouldRetry = () => true, onRetry = () => {} } = {}
) {
  let attempt = 0;
  let delay = initialBackoffMs;
  while (attempt <= retries) {
    try {
      return await taskFn(attempt);
    } catch (error) {
      if (attempt === retries || !shouldRetry(error)) {
        throw error;
      }
      onRetry({ attempt: attempt + 1, error, nextDelayMs: delay });
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
      attempt += 1;
    }
  }
  throw new Error("Unexpected retry state");
}

export function buildErrorEnvelope({
  code,
  message,
  requestId,
  retryable = false,
  details = {},
}) {
  return {
    error: {
      code,
      message,
      retryable,
      requestId,
      details,
    },
  };
}

export function fallbackNoResultsResponse(preference) {
  return {
    recommendations: [],
    summary:
      "No exact matches found. Try widening your place, increasing budget, or lowering minimum rating.",
    next_actions: [
      "Increase price budget",
      "Reduce minimum rating",
      "Try nearby place names",
      "Add more cuisines",
    ],
    preference_echo: preference,
  };
}

export async function runHardenedRecommendationFlow({
  requestId,
  clientId,
  preference,
  rateLimiter,
  logger,
  primaryTask,
  timeoutMs = 8000,
}) {
  logger.info("request_received", { requestId, clientId });

  const limit = rateLimiter.allow(clientId);
  if (!limit.allowed) {
    logger.error("rate_limited", { requestId, clientId, retryAfterMs: limit.retryAfterMs });
    return {
      ok: false,
      status: 429,
      ...buildErrorEnvelope({
        code: "RATE_LIMITED",
        message: "Too many requests. Please retry later.",
        requestId,
        retryable: true,
        details: { retryAfterMs: limit.retryAfterMs },
      }),
    };
  }

  try {
    const result = await retryWithBackoff(
      async () => await withTimeout(primaryTask, { timeoutMs }),
      {
        retries: 2,
        initialBackoffMs: 200,
        shouldRetry: (error) => /timed out|network|temporary/i.test(String(error?.message ?? error)),
        onRetry: ({ attempt, nextDelayMs, error }) => {
          logger.info("retrying_primary_task", {
            requestId,
            attempt,
            nextDelayMs,
            reason: String(error?.message ?? error),
          });
        },
      }
    );

    if (!result?.recommendations?.length) {
      logger.info("no_results_fallback", { requestId });
      return {
        ok: true,
        status: 200,
        data: fallbackNoResultsResponse(preference),
      };
    }

    logger.info("request_succeeded", {
      requestId,
      recommendationCount: result.recommendations.length,
    });
    return { ok: true, status: 200, data: result };
  } catch (error) {
    logger.error("request_failed", { requestId, reason: String(error?.message ?? error) });
    return {
      ok: false,
      status: 503,
      ...buildErrorEnvelope({
        code: "SERVICE_UNAVAILABLE",
        message: "Recommendation service is temporarily unavailable.",
        requestId,
        retryable: true,
        details: { reason: String(error?.message ?? error) },
      }),
    };
  }
}
