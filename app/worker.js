import { pipeline, env } from "@huggingface/transformers";

const DEFAULT_MODEL = "Xenova/nllb-200-distilled-600M";

const isLocalDev =
  self.location.hostname === "localhost" ||
  self.location.hostname === "127.0.0.1";

if (isLocalDev) {
  env.localModelPath = "/models/";
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.useBrowserCache = false;
} else {
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  env.useBrowserCache = true;
}

let translator = null;
let loadedModelId = null;

async function loadModel(modelId, onProgress) {
  translator = await pipeline("translation", modelId, {
    device: "wasm",
    dtype: "q8",
    progress_callback: onProgress,
  });
  loadedModelId = modelId;
}

self.onmessage = async ({ data: { type, id, payload } }) => {
  if (type === "load") {
    const modelId = payload?.modelId ?? DEFAULT_MODEL;
    try {
      translator = null;
      loadedModelId = null;
      await loadModel(modelId, (p) => self.postMessage({ type: "progress", id, payload: p }));
      self.postMessage({ type: "loaded", id, payload: { device: "wasm", modelId } });
    } catch (err) {
      self.postMessage({ type: "error", id, payload: { message: err.message } });
    }
    return;
  }

  if (type === "translate") {
    if (!translator) {
      self.postMessage({ type: "error", id, payload: { message: "Model not loaded" } });
      return;
    }
    try {
      const { text, src_lang, tgt_lang } = payload;
      const out = await translator(text, {
        src_lang,
        tgt_lang,
        max_new_tokens: 512,
      });
      self.postMessage({ type: "translated", id, payload: { translation: out[0].translation_text } });
    } catch (err) {
      self.postMessage({ type: "error", id, payload: { message: err.message } });
    }
  }
};
