// src/backend/lib/config.ts
var CONFIG = {
  MODEL: "gemini-3.5-flash-lite",
  TIMEOUT_MS: 6e4,
  MAX_SOURCE_LENGTH: 2e4,
  MAX_REQUEST_BYTES: 1e5,
  MIN_INTERVAL_MS: 4800,
  CACHE_TTL_MS: 5 * 60 * 1e3,
  CACHE_MAX: 200,
  CACHE_MAX_TEXT_LENGTH: 4e3,
  RATE_LIMIT_WINDOW_MS: 6e4,
  RATE_LIMIT_MAX_REQUESTS: 15,
  GENERATION: {
    temperature: 0.2,
    responseMimeType: "application/json",
    maxOutputTokens: 65536
  }
};
function getKey(env) {
  const key = (env.GEMINI_API_KEY ?? "").trim();
  if (!key) throw Object.assign(new Error("NO_KEY"), { code: "NO_KEY" });
  return key;
}

// src/backend/lib/circuit-breaker.ts
var CircuitBreaker = class {
  constructor(config) {
    this.config = config;
  }
  state = "closed" /* CLOSED */;
  failures = 0;
  nextAttempt = 0;
  async execute(operation, countFailure = () => true) {
    if (this.state === "open" /* OPEN */) {
      if (Date.now() < this.nextAttempt) throw new Error("CIRCUIT_OPEN");
      this.state = "half_open" /* HALF_OPEN */;
    }
    try {
      const result = await operation();
      this.failures = 0;
      this.state = "closed" /* CLOSED */;
      return result;
    } catch (error) {
      if (countFailure(error)) {
        this.failures++;
        if (this.failures >= this.config.failureThreshold) {
          this.state = "open" /* OPEN */;
          this.nextAttempt = Date.now() + this.config.resetTimeoutMs;
        }
      }
      throw error;
    }
  }
  getState() {
    return this.state;
  }
  reset() {
    this.state = "closed" /* CLOSED */;
    this.failures = 0;
    this.nextAttempt = 0;
  }
};
var instance = null;
function getCircuitBreaker() {
  instance ??= new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 3e4 });
  return instance;
}

// src/backend/lib/errors.ts
function log(level, event, fields = {}) {
  console[level](JSON.stringify({ event, ...fields, ts: (/* @__PURE__ */ new Date()).toISOString() }));
}
function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-translator-proxy", "1");
  return Response.json(data, { ...init, headers });
}

// src/backend/api/health.ts
async function onRequest({ request, env }) {
  const started = Date.now();
  const requestId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  try {
    getKey(env);
    log("info", "health_check", { requestId, durationMs: Date.now() - started });
    return json({
      ok: true,
      provider: "gemini",
      model: CONFIG.MODEL,
      configured: true,
      circuitBreaker: getCircuitBreaker().getState(),
      minIntervalMs: CONFIG.MIN_INTERVAL_MS,
      rateLimitBackend: env.RATE_LIMIT ? "kv" : "none",
      distributed: Boolean(env.RATE_LIMIT),
      ts: Date.now()
    });
  } catch (e) {
    const error = e;
    log("error", "health_check_failed", {
      requestId,
      code: error.code ?? "HEALTH_ERROR",
      message: error.message,
      durationMs: Date.now() - started
    });
    return json({
      ok: false,
      error: { message: error.message, code: error.code ?? "HEALTH_ERROR" }
    }, { status: 503 });
  }
}
export {
  onRequest
};
