// src/frontend/i18n.ts
var TEXT = {
  cs: " \u5B57\u7B26",
  copy: "\u590D\u5236",
  done: "\u5DF2\u62F7\u8D1D \u2713",
  fail: "\u7FFB\u8BD1\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5",
  emptyOut: "\u8BD1\u6587\u5C06\u5728\u8FD9\u91CC\u663E\u793A",
  ready: "\u5C31\u7EEA \xB7 \u7B49\u5F85\u8F93\u5165",
  needText: "\u8BF7\u5148\u8F93\u5165\u9700\u8981\u7FFB\u8BD1\u7684\u5185\u5BB9",
  busy: "\u6B63\u5728\u7FFB\u8BD1\u2026",
  done0: "\u7FFB\u8BD1\u5B8C\u6210 \xB7 \u4E09\u79CD\u8BED\u8A00\u5DF2\u66F4\u65B0",
  copied: "\u5DF2\u590D\u5236 ",
  noResult: "\u672A\u8FD4\u56DE\u8BD1\u6587",
  missing: "\u6A21\u578B\u8FD4\u56DE\u5185\u5BB9\u7F3A\u5C11\u8BED\u8A00\u5B57\u6BB5",
  copyFail: "\u590D\u5236\u5931\u8D25\uFF1A\u8BF7\u68C0\u67E5\u6D4F\u89C8\u5668\u526A\u8D34\u677F\u6743\u9650",
  pasteFail: "\u65E0\u6CD5\u8BFB\u53D6\u526A\u8D34\u677F\u5185\u5BB9\uFF0C\u8BF7\u6388\u4E88\u6D4F\u89C8\u5668\u7C98\u8D34\u6743\u9650",
  proxy404: "\u672A\u627E\u5230\u7FFB\u8BD1\u4EE3\u7406\u51FD\u6570",
  noKeysCfg: "\u670D\u52A1\u7AEF\u672A\u914D\u7F6E GEMINI_API_KEY",
  rateLimited: "\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5",
  keyInvalid: "API Key \u65E0\u6548\u6216\u5DF2\u8FC7\u671F",
  timeout: "\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u7F29\u77ED\u539F\u6587\u6216\u7A0D\u540E\u91CD\u8BD5",
  tooLong: "\u539F\u6587\u4E0D\u80FD\u8D85\u8FC7 20000 \u5B57\u7B26\uFF0C\u8BF7\u5206\u6BB5\u540E\u91CD\u8BD5",
  badJson: "\u8BF7\u6C42\u683C\u5F0F\u9519\u8BEF",
  queued: "\u6392\u961F\u4E2D\u2026"
};
var NAMES = { zh: "\u4E2D\u6587", ru: "\u4FC4\u8BED", kk: "\u54C8\u8428\u514B\u8BED" };
function t(key) {
  return TEXT[key] ?? key;
}
function tName(lang) {
  return NAMES[lang];
}

// src/frontend/state.ts
function createInitialState(rateLimitMs) {
  return {
    seq: 0,
    ctrl: null,
    timer: null,
    nextAt: 0,
    rateLimitMs
  };
}
function abortCurrent(state2) {
  state2.ctrl?.abort();
  state2.ctrl = new AbortController();
  if (state2.timer) {
    clearTimeout(state2.timer);
    state2.timer = null;
  }
  state2.seq++;
}
function setRateLimit(state2, ms) {
  state2.rateLimitMs = Math.max(400, ms);
}
function calculateWait(state2) {
  return state2.nextAt - Date.now();
}
function updateNextAt(state2) {
  state2.nextAt = Date.now() + state2.rateLimitMs;
}
function getSignal(state2) {
  return state2.ctrl.signal;
}
function setTimer(state2, timer) {
  state2.timer = timer;
}
function clearTimer(state2) {
  if (state2.timer) {
    clearTimeout(state2.timer);
    state2.timer = null;
  }
}

// src/frontend/api.ts
var MAX_RETRIES = 2;
var RETRY_DELAYS = [1e3, 3e3];
var RETRYABLE_CODES = ["RATE_LIMITED", "TIMEOUT", "UPSTREAM_ERR"];
async function requestTranslate(text, signal) {
  const res = await fetch("/api/translate", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  if (res.headers.get("x-translator-proxy") !== "1") {
    const err = new Error("PROXY_404");
    err.code = "PROXY_404";
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error?.message ?? `HTTP ${res.status}`);
    err.code = data.error?.code ?? "";
    err.status = res.status;
    err.retryAfter = res.headers.get("Retry-After");
    throw err;
  }
  if (!["zh", "ru", "kk"].every((k) => typeof data[k] === "string" && data[k].trim())) {
    const err = new Error("PARSE_ERROR");
    err.code = "PARSE_ERROR";
    throw err;
  }
  return { zh: data.zh, ru: data.ru, kk: data.kk };
}
function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
async function translateWithRetry(text, signal, attempt = 0) {
  try {
    return await requestTranslate(text, signal);
  } catch (e) {
    const err = e;
    const retryable = RETRYABLE_CODES.includes(err.code ?? "");
    if (retryable && attempt < MAX_RETRIES && !signal.aborted) {
      const retryAfter = Number(err.retryAfter);
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1e3, 3e4) : RETRY_DELAYS[attempt] ?? 3e3;
      await wait(delay, signal);
      return translateWithRetry(text, signal, attempt + 1);
    }
    throw err;
  }
}
async function checkHealth() {
  try {
    const r = await fetch("/api/health", { cache: "no-store" });
    if (r.headers.get("x-translator-proxy") !== "1") return null;
    const b = await r.json().catch(() => ({}));
    if (!r.ok) return null;
    const minIntervalMs = Number(b.minIntervalMs);
    return Number.isFinite(minIntervalMs) ? { minIntervalMs } : {};
  } catch {
    return null;
  }
}

// src/frontend/ui.ts
var $ = (id) => document.getElementById(id);
function status(msg, type = "ready") {
  $("statusMsg").textContent = msg;
  $("dot").className = "sdot" + (type === "busy" ? " busy" : type === "err" ? " err" : "");
}
function showTranslations(data) {
  for (const k of ["zh", "ru", "kk"]) {
    const el = $("out-" + k);
    el.textContent = data[k].trim() || t("noResult");
    el.classList.remove("empty");
  }
}
function initTheme() {
  try {
    const theme = localStorage.getItem("theme");
    if (theme) document.documentElement.dataset["theme"] = theme;
    else if (matchMedia("(prefers-color-scheme: dark)").matches) document.documentElement.dataset["theme"] = "dark";
  } catch {
  }
  $("themeBtn").addEventListener("click", () => {
    const next = document.documentElement.dataset["theme"] === "dark" ? "light" : "dark";
    document.documentElement.dataset["theme"] = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
    }
  });
}
function initCopyButtons() {
  document.querySelectorAll(".result").forEach((card) => {
    const btn = card.querySelector(".copy");
    let timeout = null;
    const copy = async () => {
      const k = card.dataset["k"];
      const el = $("out-" + k);
      if (el.classList.contains("empty")) return;
      try {
        await navigator.clipboard.writeText(el.textContent ?? "");
        btn.textContent = t("done");
        btn.classList.add("done");
        status(t("copied") + tName(k));
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          btn.textContent = t("copy");
          btn.classList.remove("done");
        }, 1400);
      } catch {
        status(t("copyFail"), "err");
      }
    };
    card.addEventListener("click", copy);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      copy();
    });
  });
}
function bindInputEvents(source2, onInput2) {
  source2.addEventListener("input", onInput2);
}
function bindActionButtons(go2, clearBtn2, pasteBtn2, onGo, onClear2, onPaste2) {
  go2.addEventListener("click", onGo);
  clearBtn2.addEventListener("click", onClear2);
  pasteBtn2.addEventListener("click", onPaste2);
}
function updateCharCount(source2) {
  $("count").textContent = source2.value.length + t("cs");
}
function clearOutputs() {
  for (const k of ["zh", "ru", "kk"]) {
    const el = $("out-" + k);
    el.textContent = t("emptyOut");
    el.classList.add("empty");
  }
}

// src/frontend/app.ts
var source = document.getElementById("source");
var go = document.getElementById("go");
var clearBtn = document.getElementById("clear");
var pasteBtn = document.getElementById("paste");
var state = createInitialState(4800);
function onInput() {
  updateCharCount(source);
  abortCurrent(state);
  if (!source.value.trim()) {
    go.disabled = false;
    status(t("ready"));
    return;
  }
  setTimer(state, setTimeout(doTranslate, 750));
}
async function doTranslate() {
  const text = source.value.trim();
  if (!text) return status(t("needText"), "err");
  abortCurrent(state);
  go.disabled = true;
  status(t("busy"), "busy");
  const n = state.seq;
  try {
    const wait2 = calculateWait(state);
    if (wait2 > 0) {
      status(t("queued"), "busy");
      await new Promise((r) => setTimeout(r, wait2));
      if (n !== state.seq) return;
    }
    updateNextAt(state);
    const result = await translateWithRetry(text, getSignal(state));
    if (n !== state.seq) return;
    showTranslations(result);
    status(t("done0"));
  } catch (e) {
    if (e.name === "AbortError") return;
    if (n !== state.seq) return;
    const err = e;
    const code = err.code;
    const msg = code === "RATE_LIMITED" ? t("rateLimited") : code === "KEY_INVALID" ? t("keyInvalid") : code === "TIMEOUT" ? t("timeout") : code === "PAYLOAD_TOO_LARGE" || code === "TEXT_TOO_LONG" ? t("tooLong") : code === "EMPTY_TEXT" ? t("needText") : code === "INVALID_JSON" ? t("badJson") : code === "PARSE_ERROR" ? t("missing") : code === "NO_KEY" ? t("noKeysCfg") : code === "PROXY_404" ? t("proxy404") : t("fail");
    status(msg, "err");
  } finally {
    if (n === state.seq) go.disabled = false;
  }
}
function onClear() {
  clearTimer(state);
  abortCurrent(state);
  source.value = "";
  updateCharCount(source);
  clearOutputs();
  go.disabled = false;
  status(t("ready"));
}
async function onPaste() {
  try {
    const text = await navigator.clipboard.readText();
    if (text !== void 0) {
      source.value = text;
      source.dispatchEvent(new Event("input", { bubbles: true }));
      status(t("ready"));
    }
  } catch {
    status(t("pasteFail"), "err");
  }
}
initTheme();
initCopyButtons();
bindInputEvents(source, onInput);
bindActionButtons(go, clearBtn, pasteBtn, doTranslate, onClear, onPaste);
async function initHealthCheck() {
  const health = await checkHealth();
  if (health?.minIntervalMs) setRateLimit(state, health.minIntervalMs);
}
initHealthCheck();
