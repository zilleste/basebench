import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { Decoration, EditorView, keymap, placeholder } from "@codemirror/view";

const PROVIDERS = {
  fireworks: {
    label: "Fireworks",
    keyPrefix: "fw_",
    endpoint: "https://api.fireworks.ai/inference/v1/completions",
    defaultModel: "accounts/fireworks/models/kimi-k2p6",
    modelCatalog: [
      {
        group: "Least-tuned practical picks",
        lab: "Moonshot",
        label: "Kimi K2.6",
        value: "accounts/fireworks/models/kimi-k2p6",
        note: "General Kimi route; Fireworks marks it as kind Base model, but it is still an agentic/post-trained compromise.",
      },
      {
        group: "Least-tuned practical picks",
        lab: "Z.ai",
        label: "GLM 5.2",
        value: "accounts/fireworks/models/glm-5p2",
        note: "Latest GLM flagship route with completions/logprobs support.",
      },
      {
        group: "Least-tuned practical picks",
        lab: "DeepSeek",
        label: "DeepSeek V4 Pro",
        value: "accounts/fireworks/models/deepseek-v4-pro",
        note: "Latest large DeepSeek route with a completions-compatible Fireworks id.",
      },
      {
        group: "Least-tuned practical picks",
        lab: "MiniMax",
        label: "MiniMax M3",
        value: "accounts/fireworks/models/minimax-m3",
        note: "Latest MiniMax serverless route in the Fireworks catalog.",
      },
      {
        group: "Least-tuned practical picks",
        lab: "Qwen",
        label: "Qwen3.7 Plus",
        value: "accounts/fireworks/models/qwen3p7-plus",
        note: "Current large Qwen route on Fireworks; tuned, but accessible pay-per-token.",
      },
      {
        group: "Other useful controls",
        lab: "OpenAI",
        label: "gpt-oss 120B",
        value: "accounts/fireworks/models/gpt-oss-120b",
        note: "Open-weight GPT-OSS route; useful as a comparatively cheap control.",
      },
      {
        group: "Other useful controls",
        lab: "Moonshot",
        label: "Kimi K2.7 Code",
        value: "accounts/fireworks/models/kimi-k2p7-code",
        note: "Newer Kimi checkpoint, but code-specialized and more tuned than K2.6.",
      },
      {
        group: "Other useful controls",
        lab: "Qwen",
        label: "Qwen3 Coder 480B A35B",
        value: "accounts/fireworks/models/qwen3-coder-480b-a35b-instruct",
        note: "Large Qwen code-specialized checkpoint; not a base model, but good for comparison.",
      },
    ],
    maxTopLogprobs: 5,
    supportsStreaming: true,
    headers(key) {
      return {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      };
    },
    scoreBody({ model, text, topLogprobs }) {
      const k = clampInt(topLogprobs, 1, this.maxTopLogprobs);
      return {
        model,
        prompt: text,
        max_tokens: 1,
        temperature: 0,
        echo: true,
        logprobs: true,
        top_logprobs: k,
        return_token_ids: true,
        raw_output: true,
        perf_metrics_in_response: true,
      };
    },
    sampleBody({ model, prefix, maxTokens, temperature, topP, minP, topLogprobs, count = 1, stream = false, promptCacheKey }) {
      const k = clampInt(topLogprobs, 1, this.maxTopLogprobs);
      return {
        model,
        prompt: prefix,
        n: clampInt(count, 1, 8),
        max_tokens: clampInt(maxTokens, 1, 200),
        temperature: clampNumber(temperature, 0, 2),
        top_p: clampNumber(topP, 0, 1),
        min_p: clampNumber(minP, 0, 1),
        stream,
        logprobs: true,
        top_logprobs: k,
        prompt_cache_key: promptCacheKey,
      };
    },
    parseScore(json, text) {
      const choice = json?.choices?.[0];
      return {
        tokens: extractContentTokens(choice?.logprobs?.content, text),
        usage: json?.usage ?? null,
      };
    },
    parseSample(json) {
      const choices = Array.isArray(json?.choices) ? json.choices : [];
      return choices.map((choice, index) => ({
        index,
        text: choice?.text ?? "",
        avgLogprob: averageLogprob(choice?.logprobs?.content?.map((item) => item?.logprob)),
        firstAlternatives: normalizeTopLogprobs(choice?.logprobs?.content?.[0]?.top_logprobs),
        done: true,
      }));
    },
    parseStreamChoice(json) {
      const choice = json?.choices?.[0];
      if (!choice) return null;
      const content = choice.logprobs?.content?.[0];
      return {
        text: choice.text ?? "",
        finishReason: choice.finish_reason ?? null,
        logprob: nullableNumber(content?.logprob),
        alternatives: normalizeTopLogprobs(content?.top_logprobs),
      };
    },
  },
  together: {
    label: "Together",
    keyPrefix: "tgp_",
    endpoint: "https://api.together.xyz/v1/completions",
    defaultModel: "Qwen/Qwen3.5-397B-A17B",
    modelCatalog: [
      {
        group: "Least-tuned practical picks",
        lab: "Qwen",
        label: "Qwen3.5 397B A17B",
        value: "Qwen/Qwen3.5-397B-A17B",
        note: "Largest Qwen route found with Together completions coverage.",
      },
      {
        group: "Least-tuned practical picks",
        lab: "Z.ai",
        label: "GLM 5.2",
        value: "zai-org/GLM-5.2",
        note: "Latest GLM route in Together's catalog.",
      },
      {
        group: "Least-tuned practical picks",
        lab: "DeepSeek",
        label: "DeepSeek V4 Pro",
        value: "deepseek-ai/DeepSeek-V4-Pro",
        note: "Latest large DeepSeek route exposed by Together.",
      },
      {
        group: "Least-tuned practical picks",
        lab: "Moonshot",
        label: "Kimi K2.6",
        value: "moonshotai/Kimi-K2.6",
        note: "General Kimi K2.6 route; K2.7 Code is newer but more specialized.",
      },
      {
        group: "Other useful controls",
        lab: "MiniMax",
        label: "MiniMax M3",
        value: "MiniMaxAI/MiniMax-M3",
        note: "Latest MiniMax route in Together's serverless catalog.",
      },
      {
        group: "Other useful controls",
        lab: "Qwen",
        label: "Qwen3.7 Max",
        value: "Qwen/Qwen3.7-Max",
        note: "Newer Qwen flagship route; likely more chat/agent tuned than Qwen3.5 397B.",
      },
      {
        group: "Other useful controls",
        lab: "Google",
        label: "Gemma 4 31B IT",
        value: "google/gemma-4-31B-it",
        note: "Current large Gemma route on Together; much smaller, but useful as an open-weight control.",
      },
      {
        group: "Cheap controls",
        lab: "Qwen",
        label: "Qwen3.5 35B A3B",
        value: "Qwen/Qwen3.5-35B-A3B",
        note: "Cheaper Qwen control for quick iteration.",
      },
      {
        group: "Cheap controls",
        lab: "Qwen",
        label: "Qwen3.5 9B",
        value: "Qwen/Qwen3.5-9B",
        note: "Small, cheap Qwen control for UI testing.",
      },
    ],
    maxTopLogprobs: 20,
    supportsStreaming: false,
    headers(key) {
      return {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      };
    },
    scoreBody({ model, text, topLogprobs }) {
      return {
        model,
        prompt: text,
        max_tokens: 1,
        temperature: 0,
        echo: true,
        logprobs: clampInt(topLogprobs, 1, this.maxTopLogprobs),
      };
    },
    sampleBody({ model, prefix, count, maxTokens, temperature, topP, minP, topLogprobs }) {
      return {
        model,
        prompt: prefix,
        n: clampInt(count, 1, 8),
        max_tokens: clampInt(maxTokens, 1, 200),
        temperature: clampNumber(temperature, 0, 2),
        top_p: clampNumber(topP, 0, 1),
        min_p: clampNumber(minP, 0, 1),
        logprobs: clampInt(topLogprobs, 1, this.maxTopLogprobs),
      };
    },
    parseScore(json, text) {
      const prompt = Array.isArray(json?.prompt) ? json.prompt[0] : null;
      const choice = Array.isArray(json?.choices) ? json.choices[0] : null;
      return {
        tokens: extractLegacyTokens(prompt?.logprobs || choice?.logprobs, text),
        usage: json?.usage ?? null,
      };
    },
    parseSample(json) {
      const choices = Array.isArray(json?.choices) ? json.choices : [];
      return choices.map((choice, index) => ({
        index,
        text: choice?.text ?? "",
        avgLogprob: averageLogprob(choice?.logprobs?.token_logprobs),
        firstAlternatives: normalizeTopLogprobs(choice?.logprobs?.top_logprobs?.[0]),
        done: true,
      }));
    },
  },
};

const SAMPLE_TEXT = "The rain had been falling upward for eleven minutes before Mara looked out the kitchen window and realized the city was holding its breath.";
const SETTINGS_KEY = "baseWorkbench.settings.v2";
const DOC_KEY = "baseWorkbench.document.v2";
const DOC_ID_KEY = "baseWorkbench.documentId.v1";
const CACHE_INDEX_KEY = "baseWorkbench.cacheIndex.v1";
const CACHE_PREFIX = "baseWorkbench.cache.v1.";
const CUSTOM_MODEL_VALUE = "__custom__";
const CACHE_MAX_BYTES = 4_200_000;
const CACHE_MAX_ENTRIES = 180;
const SAMPLE_DEBOUNCE_MS = 420;
const SCORE_VERSION = "score-v2";
const SAMPLE_VERSION = "sample-v2";

const DEMO_TOKENS = [
  ["The", null],
  [" rain", -1.08],
  [" had", -0.36],
  [" been", -0.44],
  [" falling", -2.15],
  [" upward", -5.28],
  [" for", -1.12],
  [" eleven", -3.74],
  [" minutes", -1.35],
  [" before", -0.82],
  [" Mara", -3.4],
  [" looked", -1.1],
  [" out", -0.92],
  [" the", -0.58],
  [" kitchen", -2.9],
  [" window", -1.04],
  [" and", -0.48],
  [" realized", -2.2],
  [" the", -0.4],
  [" city", -2.7],
  [" was", -0.8],
  [" holding", -3.95],
  [" its", -1.1],
  [" breath", -2.6],
  [".", -0.7],
];

const setScoreEffect = StateEffect.define();
const setActiveTokenEffect = StateEffect.define();

const scoreField = StateField.define({
  create() {
    return scoreState([], null);
  },
  update(value, transaction) {
    let tokens = value.tokens;
    let activeIndex = value.activeIndex;
    let changed = false;

    if (transaction.docChanged) {
      tokens = [];
      activeIndex = null;
      changed = true;
    }

    for (const effect of transaction.effects) {
      if (effect.is(setScoreEffect)) {
        tokens = effect.value || [];
        activeIndex = null;
        changed = true;
      } else if (effect.is(setActiveTokenEffect)) {
        activeIndex = effect.value;
        changed = true;
      }
    }

    return changed ? scoreState(tokens, activeIndex) : value;
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

function scoreState(tokens, activeIndex) {
  return {
    tokens,
    activeIndex,
    decorations: buildScoreDecorations(tokens, activeIndex),
  };
}

const el = {
  provider: document.querySelector("#provider"),
  modelPreset: document.querySelector("#model-preset"),
  model: document.querySelector("#model"),
  apiKey: document.querySelector("#api-key"),
  toggleKey: document.querySelector("#toggle-key"),
  statusLine: document.querySelector(".status-line"),
  status: document.querySelector("#status"),
  metrics: document.querySelector("#metrics"),
  editor: document.querySelector("#editor"),
  loadSample: document.querySelector("#load-sample"),
  scoreText: document.querySelector("#score-text"),
  sampleCount: document.querySelector("#sample-count"),
  sampleTokens: document.querySelector("#sample-tokens"),
  temperature: document.querySelector("#temperature"),
  topP: document.querySelector("#top-p"),
  minP: document.querySelector("#min-p"),
  topLogprobs: document.querySelector("#top-logprobs"),
  autoSample: document.querySelector("#auto-sample"),
  resample: document.querySelector("#resample"),
  abortSampling: document.querySelector("#abort-sampling"),
  clearCache: document.querySelector("#clear-cache"),
  cacheStatus: document.querySelector("#cache-status"),
  completionMeta: document.querySelector("#completion-meta"),
  alternatives: document.querySelector("#alternatives"),
  continuations: document.querySelector("#continuations"),
  continuationTemplate: document.querySelector("#continuation-template"),
};

let view;
let sampleTimer = null;
let activeSampleJob = null;
let sampleJobSerial = 0;
let lastAnchorKey = "";
let lastAnchor = { pos: 0, prefix: "" };
let localDocSaveTimer = null;
let suppressAutoSample = false;
const memoryCache = new Map();

init();

function init() {
  restorePreferences();
  syncProviderDefaults(false);
  initEditor();
  attachEvents();
  updateCacheStatus();
  updateAnchor({ forceSample: false });
}

function initEditor() {
  const storedDoc = localStorage.getItem(DOC_KEY) || "At dusk the museum unlocked itself, not with a sound but with a change in the pressure of the air.";
  view = new EditorView({
    parent: el.editor,
    state: EditorState.create({
      doc: storedDoc,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        placeholder("Start writing..."),
        scoreField,
        EditorView.lineWrapping,
        EditorView.domEventHandlers({
          click(event, editorView) {
            const pos = editorView.posAtCoords({ x: event.clientX, y: event.clientY });
            if (pos != null) {
              setTimeout(() => updateAnchor({ forceSample: false }), 0);
            }
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            debounceSaveDocument();
            if (!suppressAutoSample) {
              setStatus("Draft changed. Score when ready.");
            }
          }
          if (update.docChanged || update.selectionSet) {
            updateAnchor({ forceSample: false });
          }
        }),
      ],
    }),
  });
}

function attachEvents() {
  document.querySelector("#settings-form").addEventListener("submit", (event) => {
    event.preventDefault();
  });

  el.provider.addEventListener("change", () => {
    abortSampling("provider change");
    syncProviderDefaults(true);
    persistPreferences();
    updateAnchor({ forceSample: false });
  });

  el.modelPreset.addEventListener("change", () => {
    handleModelPresetChange();
  });

  el.model.addEventListener("input", () => {
    syncModelPresetToValue();
  });

  for (const input of [el.model, el.sampleCount, el.sampleTokens, el.temperature, el.topP, el.minP, el.topLogprobs, el.autoSample]) {
    input.addEventListener("change", () => {
      if (input === el.model) syncModelPresetToValue();
      persistPreferences();
      abortSampling("settings change");
      updateAnchor({ forceSample: false });
    });
  }

  el.apiKey.addEventListener("input", () => {
    sessionStorage.setItem(keyStorageName(), el.apiKey.value);
    updateAnchor({ forceSample: false });
  });

  el.toggleKey.addEventListener("click", () => {
    const showing = el.apiKey.type === "text";
    el.apiKey.type = showing ? "password" : "text";
    el.toggleKey.title = showing ? "Show API key" : "Hide API key";
    el.toggleKey.setAttribute("aria-label", el.toggleKey.title);
  });

  el.loadSample.addEventListener("click", () => {
    replaceDocument(SAMPLE_TEXT);
    const tokens = makeDemoTokens(SAMPLE_TEXT);
    view.dispatch({ effects: setScoreEffect.of(tokens) });
    setStatus("Loaded sample.");
    setMetrics("demo");
    updateAnchor({ forceSample: false });
  });

  el.scoreText.addEventListener("click", () => {
    scoreText({ force: false }).catch(showError);
  });

  el.resample.addEventListener("click", () => {
    updateAnchor({ forceSample: true });
  });

  el.abortSampling.addEventListener("click", () => {
    abortSampling("manual");
    setStatus("Sampling aborted.");
  });

  el.clearCache.addEventListener("click", () => {
    clearCache();
    updateCacheStatus();
    setStatus("Cache cleared.");
  });
}

function replaceDocument(text) {
  suppressAutoSample = true;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
    selection: { anchor: Math.min(text.length, text.length) },
  });
  suppressAutoSample = false;
  localStorage.setItem(DOC_KEY, text);
}

async function scoreText({ force }) {
  const text = docText();
  if (!text.trim()) {
    throw new Error("There is no text to score.");
  }

  const provider = getProvider();
  const key = requireKey();
  const params = {
    version: SCORE_VERSION,
    provider: el.provider.value,
    model: el.model.value.trim(),
    topLogprobs: clampInt(el.topLogprobs.value, 1, provider.maxTopLogprobs),
    text,
  };
  const cacheKey = await makeCacheKey("score", params);
  if (!force) {
    const cached = getCache(cacheKey);
    if (cached?.tokens?.length) {
      view.dispatch({ effects: setScoreEffect.of(cached.tokens) });
      setStatus(`Scored ${cached.tokens.length} tokens from cache.`);
      setMetrics([formatUsage(cached.usage), "cache"].filter(Boolean).join(" · "));
      updateAnchor({ forceSample: false });
      return;
    }
  }

  setBusy(true);
  try {
    setStatus(`Scoring ${text.length.toLocaleString()} chars with ${provider.label}.`);
    const started = performance.now();
    const json = await postJson(provider.endpoint, provider.headers(key), provider.scoreBody({
      model: params.model,
      text,
      topLogprobs: params.topLogprobs,
    }), undefined, { providerId: el.provider.value, model: params.model });
    const parsed = provider.parseScore(json, text);
    view.dispatch({ effects: setScoreEffect.of(parsed.tokens) });
    putCache(cacheKey, { tokens: parsed.tokens, usage: parsed.usage });
    setStatus(`Scored ${parsed.tokens.length} tokens.`);
    setMetrics([formatUsage(parsed.usage), `${Math.round(performance.now() - started)} ms`].filter(Boolean).join(" · "));
    updateCacheStatus();
    updateAnchor({ forceSample: false });
  } finally {
    setBusy(false);
  }
}

function updateAnchor({ forceSample }) {
  if (!view) return;
  const pos = view.state.selection.main.head;
  const prefix = view.state.doc.sliceString(0, pos);
  const token = tokenForPosition(pos);
  const anchorKey = sampleAnchorKey(pos, prefix);
  const activeIndex = token ? token.index : null;
  const currentScore = view.state.field(scoreField);
  if (currentScore.activeIndex !== activeIndex) {
    view.dispatch({ effects: setActiveTokenEffect.of(activeIndex) });
  }
  if (activeSampleJob && activeSampleJob.anchorKey !== anchorKey) {
    abortSampling("anchor change");
    setStatus("Anchor changed. Sampling stopped.");
  }
  lastAnchor = { pos, prefix, token, anchorKey };
  renderAlternatives(token?.topLogprobs || []);
  renderAnchorMeta(token, pos, prefix);

  if (token?.demo && !el.apiKey.value.trim()) {
    abortSampling("demo");
    renderContinuations(makeDemoSamples(token), { cached: true });
    el.resample.disabled = true;
    return;
  }

  if (!el.autoSample.checked && !forceSample) {
    el.resample.disabled = !prefix.trim();
    return;
  }
  scheduleSample({ force: forceSample });
}

function scheduleSample({ force }) {
  clearTimeout(sampleTimer);
  const prefix = lastAnchor.prefix;
  const anchorKey = lastAnchor.anchorKey || sampleAnchorKey(lastAnchor.pos, prefix);
  if (!force && anchorKey === lastAnchorKey) return;
  lastAnchorKey = anchorKey;
  sampleTimer = setTimeout(() => {
    sampleFromAnchor({ force }).catch(showError);
  }, force ? 0 : SAMPLE_DEBOUNCE_MS);
}

async function sampleFromAnchor({ force }) {
  const prefix = lastAnchor.prefix;
  const anchorKey = lastAnchor.anchorKey || sampleAnchorKey(lastAnchor.pos, prefix);
  if (!prefix.trim()) {
    abortSampling("empty prefix");
    renderContinuations([]);
    el.resample.disabled = true;
    return;
  }

  const provider = getProvider();
  const key = requireKey({ quiet: true });
  if (!key) {
    abortSampling("missing key");
    renderContinuations([]);
    el.resample.disabled = false;
    return;
  }

  const params = {
    version: SAMPLE_VERSION,
    provider: el.provider.value,
    model: el.model.value.trim(),
    prefix,
    count: clampInt(el.sampleCount.value, 1, 8),
    maxTokens: clampInt(el.sampleTokens.value, 1, 200),
    temperature: clampNumber(el.temperature.value, 0, 2),
    topP: clampNumber(el.topP.value, 0, 1),
    minP: clampNumber(el.minP.value, 0, 1),
    topLogprobs: clampInt(el.topLogprobs.value, 1, provider.maxTopLogprobs),
  };
  const cacheKey = await makeCacheKey("sample", params);
  if (anchorKey !== lastAnchor.anchorKey) return;
  params.anchorKey = anchorKey;
  if (!force) {
    const cached = getCache(cacheKey);
    if (cached?.samples?.length) {
      renderContinuations(cached.samples, { cached: true });
      setStatus(`Loaded ${cached.samples.length} forks from cache.`);
      setMetrics("sample cache");
      updateCacheStatus();
      return;
    }
  }

  abortSampling("new anchor");
  if (provider.supportsStreaming) {
    await streamSamples(provider, key, params, cacheKey);
  } else {
    await sampleNonStreaming(provider, key, params, cacheKey);
  }
}

async function streamSamples(provider, key, params, cacheKey) {
  const job = {
    id: ++sampleJobSerial,
    anchorKey: params.anchorKey,
    controllers: [],
    samples: Array.from({ length: params.count }, (_, index) => ({
      index,
      text: "",
      logprobs: [],
      firstAlternatives: [],
      done: false,
    })),
    pending: params.count,
  };
  activeSampleJob = job;
  renderContinuations(job.samples, { streaming: true });
  setStatus(`Streaming ${params.count} forks.`);
  setSampleButtons({ running: true });

  const promptCacheKey = `${el.provider.value}:${getDocumentId()}`;
  let next = 0;
  const workers = Array.from({ length: Math.min(3, params.count) }, async () => {
    while (next < params.count && activeSampleJob?.id === job.id) {
      const index = next;
      next += 1;
      await streamOneSample(provider, key, params, promptCacheKey, job, index);
    }
  });

  await Promise.allSettled(workers);
  if (activeSampleJob?.id !== job.id) return;
  const samples = job.samples.map(finalizeSample);
  const successful = samples.filter((sample) => !sample.error && sample.text);
  if (successful.length) {
    putCache(cacheKey, { samples: successful });
  }
  renderContinuations(samples);
  const failed = samples.length - successful.length;
  setStatus(failed ? `Streamed ${successful.length} forks; ${failed} failed.` : `Streamed ${samples.length} forks.`);
  setMetrics(failed ? "stream · partial" : "stream");
  setSampleButtons({ running: false });
  activeSampleJob = null;
  updateCacheStatus();
}

async function streamOneSample(provider, key, params, promptCacheKey, job, index) {
  const controller = new AbortController();
  job.controllers.push(controller);
  const sample = job.samples[index];
  try {
    const response = await fetch(provider.endpoint, {
      method: "POST",
      headers: provider.headers(key),
      signal: controller.signal,
      body: JSON.stringify(provider.sampleBody({
        model: params.model,
        prefix: params.prefix,
        maxTokens: params.maxTokens,
        temperature: params.temperature,
        topP: params.topP,
        minP: params.minP,
        topLogprobs: params.topLogprobs,
        stream: true,
        promptCacheKey,
      })),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(formatProviderError({
        providerId: el.provider.value,
        model: params.model,
        status: response.status,
        statusText: response.statusText,
        detail: parseErrorDetail(detail),
      }));
    }
    await readSSE(response, (json) => {
      if (activeSampleJob?.id !== job.id) return;
      const chunk = provider.parseStreamChoice(json);
      if (!chunk) return;
      sample.text += chunk.text;
      if (Number.isFinite(chunk.logprob)) sample.logprobs.push(chunk.logprob);
      if (!sample.firstAlternatives.length && chunk.alternatives.length) {
        sample.firstAlternatives = chunk.alternatives;
        if (!lastAnchor.token?.topLogprobs?.length) renderAlternatives(chunk.alternatives);
      }
      if (chunk.finishReason) sample.done = true;
      renderContinuation(sample);
    }, controller.signal);
    sample.done = true;
  } catch (error) {
    if (controller.signal.aborted || activeSampleJob?.id !== job.id) return;
    sample.error = error.message || String(error);
  } finally {
    if (activeSampleJob?.id === job.id) {
      sample.done = true;
      renderContinuation(sample);
    }
  }
}

async function sampleNonStreaming(provider, key, params, cacheKey) {
  const controller = new AbortController();
  const job = {
    id: ++sampleJobSerial,
    anchorKey: params.anchorKey,
    controllers: [controller],
    samples: Array.from({ length: params.count }, (_, index) => ({ index, text: "", done: false })),
  };
  activeSampleJob = job;
  renderContinuations(job.samples, { streaming: true });
  setStatus(`Sampling ${params.count} forks.`);
  setSampleButtons({ running: true });
  try {
    const json = await postJson(provider.endpoint, provider.headers(key), provider.sampleBody({
      model: params.model,
      prefix: params.prefix,
      count: params.count,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
      topP: params.topP,
      minP: params.minP,
      topLogprobs: params.topLogprobs,
    }), controller.signal, { providerId: el.provider.value, model: params.model });
    if (activeSampleJob?.id !== job.id) return;
    const samples = provider.parseSample(json);
    putCache(cacheKey, { samples });
    renderContinuations(samples);
    setStatus(`Sampled ${samples.length} forks.`);
    setMetrics("sample");
    setSampleButtons({ running: false });
    activeSampleJob = null;
    updateCacheStatus();
  } catch (error) {
    if (activeSampleJob?.id === job.id) {
      activeSampleJob = null;
      setSampleButtons({ running: false });
    }
    throw error;
  }
}

function abortSampling(reason) {
  clearTimeout(sampleTimer);
  sampleTimer = null;
  if (!activeSampleJob) {
    setSampleButtons({ running: false });
    return;
  }
  for (const controller of activeSampleJob.controllers) {
    controller.abort(reason);
  }
  activeSampleJob = null;
  setSampleButtons({ running: false });
}

function renderAnchorMeta(token, pos, prefix) {
  el.completionMeta.replaceChildren(
    summaryLine("Cursor", `${pos.toLocaleString()} / ${view.state.doc.length.toLocaleString()}`),
    summaryLine("Prefix", `${prefix.length.toLocaleString()} chars`),
    summaryLine("Token", token ? tokenLabel(token) : "none"),
  );
}

function renderAlternatives(alternatives) {
  el.alternatives.replaceChildren();
  if (!alternatives.length) {
    const span = document.createElement("span");
    span.className = "muted-inline";
    span.textContent = "No alternatives";
    el.alternatives.appendChild(span);
    return;
  }
  for (const alt of alternatives.slice(0, 12)) {
    const chip = document.createElement("span");
    chip.className = "alt-chip";
    const token = document.createElement("span");
    token.textContent = alt.token || " ";
    const score = document.createElement("small");
    score.textContent = formatNumber(alt.logprob);
    chip.append(token, score);
    el.alternatives.appendChild(chip);
  }
}

function renderContinuations(samples, options = {}) {
  el.continuations.replaceChildren();
  for (const sample of samples) {
    const node = createContinuationNode(sample, options);
    el.continuations.appendChild(node);
  }
  if (!samples.length) {
    const empty = document.createElement("div");
    empty.className = "completion-meta";
    empty.textContent = el.apiKey.value.trim() ? "No forks" : "No key";
    el.continuations.appendChild(empty);
  }
  setSampleButtons({ running: Boolean(options.streaming) });
}

function renderContinuation(sample) {
  const existing = el.continuations.querySelector(`[data-sample-index="${sample.index}"]`);
  const next = createContinuationNode(sample, { streaming: !sample.done });
  if (existing) {
    existing.replaceWith(next);
  } else {
    el.continuations.appendChild(next);
  }
}

function createContinuationNode(sample, options = {}) {
  const fragment = el.continuationTemplate.content.cloneNode(true);
  const article = fragment.querySelector(".continuation");
  article.dataset.sampleIndex = String(sample.index);
  article.classList.toggle("loading", options.streaming && !sample.done);
  article.classList.toggle("error", Boolean(sample.error));
  fragment.querySelector(".continuation-index").textContent = `fork ${sample.index + 1}`;
  const avg = sample.avgLogprob ?? averageLogprob(sample.logprobs);
  fragment.querySelector(".continuation-logprob").textContent = Number.isFinite(avg)
    ? `avg ${formatNumber(avg)}`
    : sample.done ? "" : "streaming";
  fragment.querySelector("p").textContent = sample.error || sample.text || (options.streaming ? " " : "");
  return fragment;
}

function finalizeSample(sample) {
  return {
    index: sample.index,
    text: sample.text,
    avgLogprob: averageLogprob(sample.logprobs),
    firstAlternatives: sample.firstAlternatives || [],
    error: sample.error || "",
    done: true,
  };
}

async function readSSE(response, onData, signal) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Streaming response has no body.");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    if (signal.aborted) return;
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() || "";
    for (const event of events) {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (!data || data === "[DONE]") continue;
      onData(JSON.parse(data));
    }
  }
}

async function postJson(url, headers, body, signal, context = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok) {
    const detail = json?.error?.message || json?.message || text || response.statusText;
    throw new Error(formatProviderError({
      ...context,
      status: response.status,
      statusText: response.statusText,
      detail,
    }));
  }
  if (!json) {
    throw new Error("The provider returned an empty response.");
  }
  return json;
}

function parseErrorDetail(text) {
  if (!text) return "";
  try {
    const json = JSON.parse(text);
    return json?.error?.message || json?.message || text;
  } catch {
    return text;
  }
}

function formatProviderError({ providerId, model, status, statusText, detail }) {
  const cleanDetail = String(detail || statusText || "").slice(0, 500);
  if (providerId === "together" && /non-serverless|dedicated endpoint/i.test(cleanDetail)) {
    return `${status} ${statusText}: Together requires a dedicated endpoint for ${model}. Create and start that endpoint in Together, then paste its generated endpoint model name into Model, or choose a serverless Together model.`;
  }
  return `${status} ${statusText}: ${cleanDetail}`;
}

function buildScoreDecorations(tokens, activeIndex) {
  if (!tokens.length) return Decoration.none;
  const maxSurprisal = Math.max(3, ...tokens.map((token) => token.surprisal || 0));
  const ranges = [];
  for (const token of tokens) {
    if (!Number.isFinite(token.offset) || !Number.isFinite(token.end) || token.end <= token.offset) continue;
    const className = token.index === activeIndex ? "score-token score-token-active" : "score-token";
    const mark = Decoration.mark({
      class: className,
      attributes: {
        style: `--token-bg: ${surprisalColor(token.surprisal || 0, maxSurprisal)}`,
        title: tokenTitle(token),
      },
    });
    ranges.push(mark.range(token.offset, token.end));
  }
  return Decoration.set(ranges, true);
}

function tokenForPosition(pos) {
  const tokens = view.state.field(scoreField).tokens;
  if (!tokens.length) return null;
  const probe = pos > 0 ? pos - 1 : pos;
  return tokens.find((token) => token.offset <= probe && probe < token.end) || null;
}

function extractLegacyTokens(logprobs, sourceText) {
  const rawTokens = Array.isArray(logprobs?.tokens) ? logprobs.tokens : [];
  const rawLogprobs = Array.isArray(logprobs?.token_logprobs) ? logprobs.token_logprobs : [];
  const rawOffsets = Array.isArray(logprobs?.text_offset) ? logprobs.text_offset : [];
  const rawTokenIds = Array.isArray(logprobs?.token_ids) ? logprobs.token_ids : [];
  const rawTop = Array.isArray(logprobs?.top_logprobs) ? logprobs.top_logprobs : [];
  const tokens = [];
  let cursor = 0;
  for (let index = 0; index < rawTokens.length; index += 1) {
    const explicitOffset = finiteNumber(rawOffsets[index]);
    const fallback = rawTokens[index] ?? "";
    const offset = explicitOffset != null && explicitOffset >= 0 ? explicitOffset : cursor;
    if (offset >= sourceText.length) break;
    const inferredEnd = Math.min(sourceText.length, offset + String(fallback).length);
    const nextOffset = nextSourceOffset(rawOffsets, index, sourceText.length) ?? inferredEnd;
    const text = sourceText.slice(offset, nextOffset) || fallback;
    cursor = offset + text.length;
    const logprob = nullableNumber(rawLogprobs[index]);
    tokens.push(tokenFromParts(tokens.length, text, offset, nextOffset, rawTokenIds[index], logprob, normalizeTopLogprobs(rawTop[index])));
  }
  return tokens;
}

function extractContentTokens(content, sourceText) {
  const raw = Array.isArray(content) ? content : [];
  const tokens = [];
  let cursor = 0;
  for (let index = 0; index < raw.length; index += 1) {
    const item = raw[index] || {};
    const explicitOffset = finiteNumber(item.text_offset);
    const offset = explicitOffset ?? cursor;
    if (offset >= sourceText.length) break;
    const decoded = bytesToString(item.bytes);
    const fallback = decoded || item.token || "";
    const inferredEnd = Math.min(sourceText.length, offset + fallback.length);
    const nextOffset = nextContentOffset(raw, index, sourceText.length) ?? inferredEnd;
    const text = sourceText.slice(offset, nextOffset) || fallback;
    cursor = offset + text.length;
    const logprob = nullableNumber(item.logprob);
    tokens.push(tokenFromParts(tokens.length, text, offset, nextOffset, item.token_id ?? item.tokenId, logprob, normalizeTopLogprobs(item.top_logprobs)));
  }
  return tokens;
}

function tokenFromParts(index, text, offset, end, tokenId, logprob, topLogprobs) {
  return {
    index,
    text,
    offset,
    end,
    tokenId: tokenId ?? null,
    logprob,
    surprisal: Number.isFinite(logprob) ? -logprob : null,
    topLogprobs,
  };
}

function nextSourceOffset(offsets, index, sourceLength) {
  const current = finiteNumber(offsets[index]);
  if (current == null || current < 0) return null;
  for (let i = index + 1; i < offsets.length; i += 1) {
    const candidate = finiteNumber(offsets[i]);
    if (candidate != null && candidate >= 0 && candidate > current) {
      return Math.min(sourceLength, candidate);
    }
  }
  return null;
}

function nextContentOffset(content, index, sourceLength) {
  const current = finiteNumber(content[index]?.text_offset);
  if (current == null) return null;
  for (let i = index + 1; i < content.length; i += 1) {
    const candidate = finiteNumber(content[i]?.text_offset);
    if (candidate != null && candidate > current) {
      return Math.min(sourceLength, candidate);
    }
  }
  return null;
}

function normalizeTopLogprobs(entry) {
  if (!entry) return [];
  if (Array.isArray(entry)) {
    return entry
      .map((item) => ({
        token: item?.token ?? item?.text ?? "",
        logprob: nullableNumber(item?.logprob),
        tokenId: item?.token_id ?? item?.tokenId ?? null,
      }))
      .filter((item) => item.token || Number.isFinite(item.logprob));
  }
  if (typeof entry === "object") {
    return Object.entries(entry)
      .map(([token, logprob]) => ({ token, logprob: nullableNumber(logprob), tokenId: null }))
      .filter((item) => item.token || Number.isFinite(item.logprob));
  }
  return [];
}

function makeDemoTokens(text) {
  let cursor = 0;
  return DEMO_TOKENS.map(([piece, logprob], index) => {
    const offset = cursor;
    cursor += piece.length;
    return {
      index,
      text: piece,
      offset,
      end: Math.min(cursor, text.length),
      tokenId: index + 1000,
      logprob,
      surprisal: Number.isFinite(logprob) ? -logprob : null,
      topLogprobs: [
        { token: piece, logprob },
        { token: " shadow", logprob: Number.isFinite(logprob) ? logprob - 0.7 : -2.8 },
        { token: " door", logprob: Number.isFinite(logprob) ? logprob - 1.1 : -3.4 },
      ],
      demo: true,
    };
  }).filter((token) => token.offset < text.length && token.end > token.offset);
}

function makeDemoSamples(token) {
  const forks = [
    " as though the sky had briefly forgotten which way grief was supposed to fall.",
    " and the gutters whispered with the small, private panic of silver fish.",
    " while every window in the block brightened one shade, then went still.",
    " until the streetlamps blinked awake and pretended they had seen nothing.",
  ];
  return forks.map((text, index) => ({
    index,
    text,
    avgLogprob: -1.2 - index * 0.37,
    firstAlternatives: token.topLogprobs,
    done: true,
  }));
}

function restorePreferences() {
  const stored = safeJson(localStorage.getItem(SETTINGS_KEY), {});
  if (stored.provider && PROVIDERS[stored.provider]) el.provider.value = stored.provider;
  for (const [id, value] of Object.entries(stored.fields || {})) {
    if (el[id] && typeof value === "string") el[id].value = value;
    if (el[id] && typeof value === "boolean") el[id].checked = value;
  }
  el.apiKey.value = sessionStorage.getItem(keyStorageName()) || "";
}

function persistPreferences() {
  const fields = {
    model: el.model.value,
    sampleCount: el.sampleCount.value,
    sampleTokens: el.sampleTokens.value,
    temperature: el.temperature.value,
    topP: el.topP.value,
    minP: el.minP.value,
    topLogprobs: el.topLogprobs.value,
    autoSample: el.autoSample.checked,
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ provider: el.provider.value, fields }));
}

function debounceSaveDocument() {
  clearTimeout(localDocSaveTimer);
  localDocSaveTimer = setTimeout(() => {
    localStorage.setItem(DOC_KEY, docText());
  }, 250);
}

function syncProviderDefaults(forceModel) {
  const provider = getProvider();
  el.apiKey.value = sessionStorage.getItem(keyStorageName()) || "";
  el.topLogprobs.max = String(provider.maxTopLogprobs);
  if (Number(el.topLogprobs.value) > provider.maxTopLogprobs) {
    el.topLogprobs.value = String(provider.maxTopLogprobs);
  }
  if (forceModel || !el.model.value) {
    el.model.value = provider.defaultModel;
  }
  renderModelPicker(provider);
  syncModelPresetToValue();
}

function renderModelPicker(provider) {
  const byGroup = new Map();
  for (const item of modelCatalog(provider)) {
    const group = item.group || "Models";
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push(item);
  }

  const nodes = [];
  for (const [group, items] of byGroup.entries()) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group;
    optgroup.append(...items.map((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = modelOptionLabel(item);
      option.title = item.note || item.value;
      return option;
    }));
    nodes.push(optgroup);
  }

  const customOption = document.createElement("option");
  customOption.value = CUSTOM_MODEL_VALUE;
  customOption.textContent = "Custom model id";
  nodes.push(customOption);
  el.modelPreset.replaceChildren(...nodes);
}

function handleModelPresetChange() {
  const value = el.modelPreset.value;
  if (value === CUSTOM_MODEL_VALUE) {
    el.model.focus();
    return;
  }

  const item = catalogItemForValue(value);
  el.model.value = item?.value || value;
  syncModelPresetToValue();
  persistPreferences();
  abortSampling("model change");
  updateAnchor({ forceSample: false });
}

function syncModelPresetToValue() {
  const value = el.model.value.trim();
  const item = catalogItemForValue(value);
  el.modelPreset.value = item ? item.value : CUSTOM_MODEL_VALUE;
  el.model.title = item?.note || value || "Paste any provider model id.";
}

function catalogItemForValue(value) {
  return modelCatalog(getProvider()).find((item) => item.value === value);
}

function modelCatalog(provider) {
  if (Array.isArray(provider.modelCatalog)) return provider.modelCatalog;
  return (provider.modelHints || []).map((hint) => ({
    group: "Models",
    label: hint,
    value: hint,
  }));
}

function modelOptionLabel(item) {
  return item.lab ? `${item.lab} - ${item.label}` : item.label;
}

function settingsFingerprint() {
  return stableStringify({
    provider: el.provider.value,
    model: el.model.value.trim(),
    count: el.sampleCount.value,
    tokens: el.sampleTokens.value,
    temperature: el.temperature.value,
    topP: el.topP.value,
    minP: el.minP.value,
    topLogprobs: el.topLogprobs.value,
    auto: el.autoSample.checked,
  });
}

function sampleAnchorKey(pos, prefix) {
  return `${pos}:${prefix.length}:${fastStableHash(prefix)}:${settingsFingerprint()}`;
}

async function makeCacheKey(kind, value) {
  return `${kind}.${await sha256(stableStringify(value))}`;
}

function getCache(cacheKey) {
  if (memoryCache.has(cacheKey)) return memoryCache.get(cacheKey);
  const raw = localStorage.getItem(CACHE_PREFIX + cacheKey);
  if (!raw) return null;
  const parsed = safeJson(raw, null);
  if (!parsed) return null;
  touchCacheEntry(cacheKey);
  memoryCache.set(cacheKey, parsed.value);
  return parsed.value;
}

function putCache(cacheKey, value) {
  try {
    const raw = JSON.stringify({ ts: Date.now(), value });
    localStorage.setItem(CACHE_PREFIX + cacheKey, raw);
    memoryCache.set(cacheKey, value);
    upsertCacheIndex(cacheKey, raw.length);
    pruneCache();
  } catch {
    pruneCache({ aggressive: true });
  }
}

function upsertCacheIndex(cacheKey, bytes) {
  const index = cacheIndex().filter((entry) => entry.key !== cacheKey);
  index.push({ key: cacheKey, bytes, ts: Date.now() });
  localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
}

function touchCacheEntry(cacheKey) {
  const index = cacheIndex();
  const entry = index.find((item) => item.key === cacheKey);
  if (!entry) return;
  entry.ts = Date.now();
  localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
}

function pruneCache(options = {}) {
  const index = cacheIndex().sort((a, b) => b.ts - a.ts);
  const maxBytes = options.aggressive ? Math.floor(CACHE_MAX_BYTES / 2) : CACHE_MAX_BYTES;
  const keep = [];
  let keptBytes = 0;
  for (const entry of index) {
    if (keep.length < CACHE_MAX_ENTRIES && keptBytes + entry.bytes <= maxBytes) {
      keep.push(entry);
      keptBytes += entry.bytes;
      continue;
    }
    localStorage.removeItem(CACHE_PREFIX + entry.key);
    memoryCache.delete(entry.key);
  }
  localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(keep));
}

function clearCache() {
  for (const entry of cacheIndex()) {
    localStorage.removeItem(CACHE_PREFIX + entry.key);
  }
  localStorage.removeItem(CACHE_INDEX_KEY);
  memoryCache.clear();
}

function cacheIndex() {
  return safeJson(localStorage.getItem(CACHE_INDEX_KEY), []);
}

function updateCacheStatus() {
  const index = cacheIndex();
  const bytes = index.reduce((sum, entry) => sum + entry.bytes, 0);
  el.cacheStatus.textContent = `${index.length} entries · ${formatBytes(bytes)}`;
}

function getProvider() {
  return PROVIDERS[el.provider.value] || PROVIDERS.fireworks;
}

function keyStorageName() {
  return `baseWorkbench.${el.provider.value}.apiKey`;
}

function requireKey(options = {}) {
  const key = el.apiKey.value.trim();
  if (!key) {
    if (!options.quiet) throw new Error("Paste a provider API key first.");
    return "";
  }
  const matchingProvider = providerForKey(key);
  if (matchingProvider && matchingProvider !== el.provider.value) {
    const provider = PROVIDERS[matchingProvider];
    if (!options.quiet) {
      throw new Error(`That looks like a ${provider.label} key. Switch Provider to ${provider.label} or paste a ${getProvider().label} key.`);
    }
    return "";
  }
  sessionStorage.setItem(keyStorageName(), key);
  return key;
}

function providerForKey(key) {
  for (const [id, provider] of Object.entries(PROVIDERS)) {
    if (provider.keyPrefix && key.startsWith(provider.keyPrefix)) return id;
  }
  return "";
}

function getDocumentId() {
  let id = localStorage.getItem(DOC_ID_KEY);
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() || `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DOC_ID_KEY, id);
  }
  return id;
}

function docText() {
  return view.state.doc.toString();
}

function setBusy(busy) {
  document.body.classList.toggle("busy", busy);
  el.scoreText.disabled = busy;
}

function setSampleButtons({ running }) {
  el.abortSampling.disabled = !running;
  el.resample.disabled = running || !lastAnchor.prefix?.trim();
}

function setStatus(message) {
  el.statusLine.classList.remove("error");
  el.status.textContent = message;
}

function setMetrics(message) {
  el.metrics.textContent = message || "";
}

function showError(error) {
  setBusy(false);
  setSampleButtons({ running: false });
  el.statusLine.classList.add("error");
  el.status.textContent = error?.message || String(error);
}

function summaryLine(label, value) {
  const line = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  const span = document.createElement("span");
  span.textContent = value;
  line.append(strong, span);
  return line;
}

function tokenLabel(token) {
  const text = token.text.replace(/\n/g, "\\n");
  const bits = [text || " "];
  if (Number.isFinite(token.logprob)) bits.push(`lp ${formatNumber(token.logprob)}`);
  if (Number.isFinite(token.surprisal)) bits.push(`s ${formatNumber(token.surprisal)}`);
  return bits.join(" · ");
}

function tokenTitle(token) {
  return [
    `token ${token.index + 1}`,
    token.tokenId != null ? `id ${token.tokenId}` : "",
    Number.isFinite(token.logprob) ? `logprob ${formatNumber(token.logprob)}` : "",
    Number.isFinite(token.surprisal) ? `surprisal ${formatNumber(token.surprisal)}` : "",
  ].filter(Boolean).join(" · ");
}

function surprisalColor(surprisal, maxSurprisal) {
  const t = Math.min(1, Math.max(0, surprisal / Math.max(4, maxSurprisal)));
  if (t < 0.45) {
    return mixColor([52, 131, 92], [233, 193, 76], t / 0.45, 0.22);
  }
  return mixColor([233, 193, 76], [180, 59, 56], (t - 0.45) / 0.55, 0.28);
}

function mixColor(a, b, t, alpha) {
  const channel = (i) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `rgba(${channel(0)}, ${channel(1)}, ${channel(2)}, ${alpha})`;
}

function averageLogprob(values) {
  if (!Array.isArray(values)) return null;
  const nums = values.filter(Number.isFinite);
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function bytesToString(bytes) {
  if (!Array.isArray(bytes) || !bytes.length) return "";
  try {
    return new TextDecoder().decode(new Uint8Array(bytes));
  } catch {
    return "";
  }
}

function formatUsage(usage) {
  const prompt = usage?.prompt_tokens ?? usage?.promptTokens;
  const completion = usage?.completion_tokens ?? usage?.completionTokens;
  const total = usage?.total_tokens ?? usage?.totalTokens;
  return [
    Number.isFinite(prompt) ? `${prompt} in` : "",
    Number.isFinite(completion) ? `${completion} out` : "",
    Number.isFinite(total) ? `${total} total` : "",
  ].filter(Boolean).join(" · ");
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(3) : "n/a";
}

function clampInt(value, min, max) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function nullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function safeJson(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(text) {
  if (!globalThis.crypto?.subtle?.digest) {
    return fastStableHash(text);
  }
  const data = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fastStableHash(text) {
  let h1 = 0xdeadbeef ^ text.length;
  let h2 = 0x41c6ce57 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0).toString(16).padStart(8, "0")}`;
}
