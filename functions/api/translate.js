var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/backend/lib/rate-limiter.ts
var rate_limiter_exports = {};
__export(rate_limiter_exports, {
  DistributedRateLimiter: () => DistributedRateLimiter
});
var DistributedRateLimiter;
var init_rate_limiter = __esm({
  "src/backend/lib/rate-limiter.ts"() {
    "use strict";
    DistributedRateLimiter = class {
      constructor(kv, config) {
        this.kv = kv;
        this.config = config;
      }
      async checkLimit(identifier) {
        const key = `${this.config.keyPrefix}:${identifier}`;
        const now = Date.now();
        const windowStart = now - this.config.windowMs;
        const stored = await this.kv.get(key, "json");
        if (!stored || stored.windowStart < windowStart) {
          await this.kv.put(key, JSON.stringify({ count: 1, windowStart: now }), {
            expirationTtl: Math.ceil(this.config.windowMs / 1e3) + 10
          });
          return {
            allowed: true,
            remaining: this.config.maxRequests - 1,
            resetTime: now + this.config.windowMs
          };
        }
        if (stored.count >= this.config.maxRequests) {
          const resetTime = stored.windowStart + this.config.windowMs;
          return {
            allowed: false,
            remaining: 0,
            resetTime,
            retryAfter: Math.ceil((resetTime - Date.now()) / 1e3)
          };
        }
        stored.count++;
        await this.kv.put(key, JSON.stringify(stored), {
          expirationTtl: Math.ceil(this.config.windowMs / 1e3) + 10
        });
        return {
          allowed: true,
          remaining: this.config.maxRequests - stored.count,
          resetTime: stored.windowStart + this.config.windowMs
        };
      }
    };
  }
});

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

// src/backend/lib/prompt.ts
var SYSTEM_PROMPT = `You are a native-level translator for Chinese (PRC), Russian (RU), Kazakh (KZ).

Return ONLY a valid JSON object with exactly these string keys: "zh", "ru", "kk".

HARD CONSTRAINTS:
- Kazakh: modern standard Cyrillic (\u049A\u0430\u0437\u0430\u049B\u0448\u0430) ONLY. Perfect vowel harmony, case suffixes, possessive agreement.
- Output ONLY the JSON object. No markdown, reasoning, explanation, or filler.
- Preserve formatting EXACTLY: code fences, markdown tables, LaTeX, line breaks, whitespace.
- UNTRANSLATABLES (copy verbatim): proper nouns, brands, acronyms, numbers, units, emails, URLs, paths, code identifiers, hashes, CLI, regex, markup keys.
- Source==target language \u2192 return source UNCHANGED for that language.

QUALITY STANDARDS:
- Native grammar, register, idioms, zero translationese
- Domain terminology accuracy (legal, medical, tech, finance, marketing, academic)
- Cultural localization: PRC (GB/T), RF (GOST), RK (\u0422\u0456\u043B \u0442\u0443\u0440\u0430\u043B\u044B \u0437\u0430\u04A3)
- Stylistic matching: preserve voice, irony, hedging, formality

OUTPUT SPEC:
{
  "zh": "Simplified Chinese, PRC norm",
  "ru": "Russian, RF norm",
  "kk": "Kazakh, Cyrillic, RK norm"
}`;
var BRIEF_TEMPLATE = `Source text follows. Apply full senior translator decision framework.

DOMAIN HINTS (auto-detect):
- Legal: "whereas", "hereby", "shall", "pursuant to", "force majeure"
- Medical: ICD codes, drug names, "adverse event", "contraindication"
- Tech: API, endpoint, latency, stack trace, CI/CD, k8s, Terraform
- Finance: SWIFT, ISIN, basis points, EBITDA, derivatives
- Marketing: CTA, hook, brand voice, transcreation flag
- Academic: citation style, passive/active balance, hedging

UNTRANSLATABLES (verbatim): proper nouns, brands, acronyms, numbers+units, emails, URLs, paths, code identifiers, hashes, CLI, regex, markup keys.

FORMAT PRESERVATION (byte-level): code fences, markdown tables, LaTeX ($$), line breaks, indentation, whitespace.

OUTPUT: ONLY JSON {"zh":"\u2026","ru":"\u2026","kk":"\u2026"}

SOURCE TEXT:
{text}`;
function buildPrompt(text) {
  return BRIEF_TEMPLATE.replace("{text}", () => text);
}

// src/backend/lib/gemini.ts
async function callGemini(key, text, signal) {
  const timeout = AbortSignal.timeout(CONFIG.TIMEOUT_MS);
  const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: buildPrompt(text) }] }],
        generationConfig: CONFIG.GENERATION
      }),
      signal: combinedSignal
    }
  );
}

// node_modules/valibot/dist/index.js
var store;
function getGlobalConfig(config2) {
  return {
    lang: config2?.lang ?? store?.lang,
    message: config2?.message,
    abortEarly: config2?.abortEarly ?? store?.abortEarly,
    abortPipeEarly: config2?.abortPipeEarly ?? store?.abortPipeEarly
  };
}
var store2;
function getGlobalMessage(lang) {
  return store2?.get(lang);
}
var store3;
function getSchemaMessage(lang) {
  return store3?.get(lang);
}
var store4;
function getSpecificMessage(reference, lang) {
  return store4?.get(reference)?.get(lang);
}
function _stringify(input) {
  const type = typeof input;
  if (type === "string") {
    return `"${input}"`;
  }
  if (type === "number" || type === "bigint" || type === "boolean") {
    return `${input}`;
  }
  if (type === "object" || type === "function") {
    return (input && Object.getPrototypeOf(input)?.constructor?.name) ?? "null";
  }
  return type;
}
function _addIssue(context, label, dataset, config2, other) {
  const input = other && "input" in other ? other.input : dataset.value;
  const expected = other?.expected ?? context.expects ?? null;
  const received = other?.received ?? _stringify(input);
  const issue = {
    kind: context.kind,
    type: context.type,
    input,
    expected,
    received,
    message: `Invalid ${label}: ${expected ? `Expected ${expected} but r` : "R"}eceived ${received}`,
    // @ts-expect-error
    requirement: context.requirement,
    path: other?.path,
    issues: other?.issues,
    lang: config2.lang,
    abortEarly: config2.abortEarly,
    abortPipeEarly: config2.abortPipeEarly
  };
  const isSchema = context.kind === "schema";
  const message = other?.message ?? // @ts-expect-error
  context.message ?? getSpecificMessage(context.reference, issue.lang) ?? (isSchema ? getSchemaMessage(issue.lang) : null) ?? config2.message ?? getGlobalMessage(issue.lang);
  if (message) {
    issue.message = typeof message === "function" ? message(issue) : message;
  }
  if (isSchema) {
    dataset.typed = false;
  }
  if (dataset.issues) {
    dataset.issues.push(issue);
  } else {
    dataset.issues = [issue];
  }
}
var ValiError = class extends Error {
  /**
   * The error issues.
   */
  issues;
  /**
   * Creates a Valibot error with useful information.
   *
   * @param issues The error issues.
   */
  constructor(issues) {
    super(issues[0].message);
    this.name = "ValiError";
    this.issues = issues;
  }
};
function minLength(requirement, message) {
  return {
    kind: "validation",
    type: "min_length",
    reference: minLength,
    async: false,
    expects: `>=${requirement}`,
    requirement,
    message,
    _run(dataset, config2) {
      if (dataset.typed && dataset.value.length < this.requirement) {
        _addIssue(this, "length", dataset, config2, {
          received: `${dataset.value.length}`
        });
      }
      return dataset;
    }
  };
}
function trim() {
  return {
    kind: "transformation",
    type: "trim",
    reference: trim,
    async: false,
    _run(dataset) {
      dataset.value = dataset.value.trim();
      return dataset;
    }
  };
}
function object(entries, message) {
  return {
    kind: "schema",
    type: "object",
    reference: object,
    expects: "Object",
    async: false,
    entries,
    message,
    _run(dataset, config2) {
      const input = dataset.value;
      if (input && typeof input === "object") {
        dataset.typed = true;
        dataset.value = {};
        for (const key in this.entries) {
          const value2 = input[key];
          const valueDataset = this.entries[key]._run(
            { typed: false, value: value2 },
            config2
          );
          if (valueDataset.issues) {
            const pathItem = {
              type: "object",
              origin: "value",
              input,
              key,
              value: value2
            };
            for (const issue of valueDataset.issues) {
              if (issue.path) {
                issue.path.unshift(pathItem);
              } else {
                issue.path = [pathItem];
              }
              dataset.issues?.push(issue);
            }
            if (!dataset.issues) {
              dataset.issues = valueDataset.issues;
            }
            if (config2.abortEarly) {
              dataset.typed = false;
              break;
            }
          }
          if (!valueDataset.typed) {
            dataset.typed = false;
          }
          if (valueDataset.value !== void 0 || key in input) {
            dataset.value[key] = valueDataset.value;
          }
        }
      } else {
        _addIssue(this, "type", dataset, config2);
      }
      return dataset;
    }
  };
}
function string(message) {
  return {
    kind: "schema",
    type: "string",
    reference: string,
    expects: "string",
    async: false,
    message,
    _run(dataset, config2) {
      if (typeof dataset.value === "string") {
        dataset.typed = true;
      } else {
        _addIssue(this, "type", dataset, config2);
      }
      return dataset;
    }
  };
}
function parse(schema, input, config2) {
  const dataset = schema._run(
    { typed: false, value: input },
    getGlobalConfig(config2)
  );
  if (dataset.issues) {
    throw new ValiError(dataset.issues);
  }
  return dataset.value;
}
function pipe(...pipe2) {
  return {
    ...pipe2[0],
    pipe: pipe2,
    _run(dataset, config2) {
      for (let index = 0; index < pipe2.length; index++) {
        if (dataset.issues && (pipe2[index].kind === "schema" || pipe2[index].kind === "transformation")) {
          dataset.typed = false;
          break;
        }
        if (!dataset.issues || !config2.abortEarly && !config2.abortPipeEarly) {
          dataset = pipe2[index]._run(dataset, config2);
        }
      }
      return dataset;
    }
  };
}

// src/backend/lib/parse.ts
var TranslationSchema = object({
  zh: pipe(string(), trim(), minLength(1)),
  ru: pipe(string(), trim(), minLength(1)),
  kk: pipe(string(), trim(), minLength(1))
});
function isGeminiPayload(payload) {
  return typeof payload === "object" && payload !== null && "candidates" in payload;
}
function isGeminiCandidate(candidate) {
  return typeof candidate === "object" && candidate !== null;
}
function isGeminiContent(content) {
  return typeof content === "object" && content !== null;
}
function isGeminiPart(part) {
  return typeof part === "object" && part !== null;
}
function extractText(payload) {
  if (!isGeminiPayload(payload)) return "";
  const candidates = payload.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  const first = candidates[0];
  if (!isGeminiCandidate(first)) return "";
  const content = first.content;
  if (!isGeminiContent(content)) return "";
  const parts = content.parts;
  if (!Array.isArray(parts)) return "";
  return parts.filter((p) => isGeminiPart(p) && !p.thought).map((p) => p.text ?? "").join("");
}
function parseTranslations(raw) {
  const parsed = parse(TranslationSchema, JSON.parse(raw));
  return parsed;
}

// src/backend/lib/errors.ts
var MESSAGES = {
  NO_KEY: "\u670D\u52A1\u7AEF\u672A\u914D\u7F6E GEMINI_API_KEY",
  INVALID_CONTENT_TYPE: "Content-Type \u5FC5\u987B\u662F application/json",
  FORBIDDEN: "\u4E0D\u5141\u8BB8\u8DE8\u7AD9\u8C03\u7528",
  INVALID_JSON: "\u8BF7\u6C42\u4F53\u5FC5\u987B\u662F\u5305\u542B text \u5B57\u6BB5\u7684 JSON",
  EMPTY_TEXT: "\u8BF7\u8F93\u5165\u9700\u8981\u7FFB\u8BD1\u7684\u5185\u5BB9",
  TEXT_TOO_LONG: "\u539F\u6587\u4E0D\u80FD\u8D85\u8FC7 20000 \u5B57\u7B26",
  PAYLOAD_TOO_LARGE: "\u8BF7\u6C42\u4F53\u8FC7\u5927",
  TIMEOUT: "\u4E0A\u6E38\u8BF7\u6C42\u8D85\u65F6",
  KEY_INVALID: "API Key \u65E0\u6548\u6216\u5DF2\u8FC7\u671F",
  RATE_LIMITED: "\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41",
  PARSE_ERROR: "\u6A21\u578B\u8FD4\u56DE\u683C\u5F0F\u9519\u8BEF",
  UPSTREAM_ERR: "\u4E0A\u6E38\u670D\u52A1\u5F02\u5E38",
  METHOD_ERR: "\u4EC5\u652F\u6301 POST",
  CIRCUIT_OPEN: "\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5"
};
var STATUS = {
  NO_KEY: 503,
  INVALID_CONTENT_TYPE: 415,
  FORBIDDEN: 403,
  INVALID_JSON: 400,
  EMPTY_TEXT: 400,
  TEXT_TOO_LONG: 413,
  PAYLOAD_TOO_LARGE: 413,
  TIMEOUT: 504,
  KEY_INVALID: 401,
  RATE_LIMITED: 429,
  PARSE_ERROR: 502,
  UPSTREAM_ERR: 502,
  METHOD_ERR: 405,
  CIRCUIT_OPEN: 503
};
function log(level, event, fields = {}) {
  console[level](JSON.stringify({ event, ...fields, ts: (/* @__PURE__ */ new Date()).toISOString() }));
}
function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-translator-proxy", "1");
  return Response.json(data, { ...init, headers });
}
function err(code) {
  return json(
    { error: { message: MESSAGES[code] ?? "\u672A\u77E5\u9519\u8BEF", code } },
    { status: STATUS[code] ?? 500 }
  );
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

// src/backend/lib/deduplicator.ts
var RequestDeduplicator = class {
  constructor(config) {
    this.config = config;
  }
  pending = /* @__PURE__ */ new Map();
  async deduplicate(key, factory) {
    const now = Date.now();
    for (const [k, v] of this.pending) {
      if (v.expires < now) this.pending.delete(k);
    }
    const existing = this.pending.get(key);
    if (existing) return existing.promise;
    const promise = Promise.resolve().then(factory).finally(() => {
      if (this.pending.get(key)?.promise === promise) this.pending.delete(key);
    });
    if (this.pending.size >= this.config.maxEntries) {
      const oldestKey = this.pending.keys().next().value;
      if (oldestKey) this.pending.delete(oldestKey);
    }
    this.pending.set(key, { promise, expires: now + this.config.ttlMs });
    return promise;
  }
};

// src/backend/api/translate.ts
var responseCache = /* @__PURE__ */ new Map();
var deduplicator = new RequestDeduplicator({ ttlMs: 12e4, maxEntries: 1e3 });
async function readBodyWithLimit(request, maxBytes) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_JSON");
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(merged);
}
async function getCacheKey(text) {
  const input = new TextEncoder().encode(`${CONFIG.MODEL}\0${text}`);
  const buf = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function getCached(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CONFIG.CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  responseCache.delete(key);
  responseCache.set(key, entry);
  return entry.data;
}
function setCached(key, data) {
  if (responseCache.size >= CONFIG.CACHE_MAX) {
    const oldest = responseCache.keys().next().value;
    if (oldest) responseCache.delete(oldest);
  }
  responseCache.set(key, { data, ts: Date.now() });
}
async function handleRequest({ request, env }) {
  if (request.method !== "POST") return err("METHOD_ERR");
  if ((request.headers.get("content-type")?.split(";")[0]?.trim() ?? "") !== "application/json") {
    return err("INVALID_CONTENT_TYPE");
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return err("FORBIDDEN");
  let key;
  try {
    key = getKey(env);
  } catch (e) {
    const code = e.code;
    if (code) return err(code);
    throw e;
  }
  if (env.RATE_LIMIT) {
    const { DistributedRateLimiter: DistributedRateLimiter2 } = await Promise.resolve().then(() => (init_rate_limiter(), rate_limiter_exports));
    const rateLimiter = new DistributedRateLimiter2(env.RATE_LIMIT, {
      windowMs: CONFIG.RATE_LIMIT_WINDOW_MS,
      maxRequests: CONFIG.RATE_LIMIT_MAX_REQUESTS,
      keyPrefix: "ratelimit"
    });
    const result = await rateLimiter.checkLimit(request.headers.get("cf-connecting-ip") ?? "unknown");
    if (!result.allowed) {
      const response = err("RATE_LIMITED");
      if (result.retryAfter) response.headers.set("Retry-After", String(result.retryAfter));
      return response;
    }
  }
  let text;
  try {
    const rawBody = await readBodyWithLimit(request, CONFIG.MAX_REQUEST_BYTES);
    const body = JSON.parse(rawBody);
    text = typeof body?.text === "string" ? body.text.trim() : "";
  } catch (e) {
    const code = e instanceof Error && e.message === "PAYLOAD_TOO_LARGE" ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON";
    return err(code);
  }
  if (!text) return err("EMPTY_TEXT");
  if (text.length > CONFIG.MAX_SOURCE_LENGTH) return err("TEXT_TOO_LONG");
  const cacheKey = await getCacheKey(text);
  const cacheable = text.length <= CONFIG.CACHE_MAX_TEXT_LENGTH;
  const cached = cacheable ? getCached(cacheKey) : null;
  if (cached) return json(cached);
  try {
    const result = await deduplicator.deduplicate(cacheKey, async () => {
      return getCircuitBreaker().execute(async () => {
        let res;
        try {
          res = await callGemini(key, text);
        } catch (e) {
          if (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")) {
            throw new Error("TIMEOUT");
          }
          throw e;
        }
        if (!res.ok) {
          log("warn", "gemini_upstream_error", { status: res.status });
          if ([401, 403].includes(res.status)) throw new Error("KEY_INVALID");
          if (res.status === 429) throw new Error("RATE_LIMITED");
          throw new Error("UPSTREAM_ERR");
        }
        const raw = extractText(await res.json().catch(() => ({})));
        if (!raw) throw new Error("PARSE_ERROR");
        try {
          return parseTranslations(raw);
        } catch {
          throw new Error("PARSE_ERROR");
        }
      }, (error) => !(error instanceof Error && ["KEY_INVALID", "RATE_LIMITED"].includes(error.message)));
    });
    if (cacheable) setCached(cacheKey, result);
    return json(result);
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (["CIRCUIT_OPEN", "PARSE_ERROR", "TIMEOUT", "KEY_INVALID", "RATE_LIMITED", "UPSTREAM_ERR"].includes(code)) {
      return err(code);
    }
    throw e;
  }
}
async function onRequest(context) {
  const { request } = context;
  const started = Date.now();
  const requestId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  try {
    const response = await handleRequest(context);
    let errorCode;
    if (!response.ok) {
      const body = await response.clone().json().catch(() => null);
      errorCode = body?.error?.code;
    }
    log(response.ok ? "info" : "warn", "translate_request", {
      requestId,
      status: response.status,
      errorCode,
      durationMs: Date.now() - started
    });
    return response;
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    log("error", "translate_unhandled_error", {
      requestId,
      message: error.message,
      stack: error.stack,
      durationMs: Date.now() - started
    });
    return err("UPSTREAM_ERR");
  }
}
export {
  onRequest
};
