import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = true;

let generator = null;

async function loadModel(modelId, onProgress) {
  generator = await pipeline("text-generation", modelId, {
    device: "webgpu",
    dtype: "q4f16",
    progress_callback: onProgress,
  });
}

self.onmessage = async ({ data: { type, id, payload } }) => {
  if (type === "load") {
    try {
      generator = null;
      await loadModel(payload.modelId, (p) => self.postMessage({ type: "progress", id, payload: p }));
      self.postMessage({ type: "loaded", id, payload: { device: "webgpu", modelId: payload.modelId } });
    } catch (err) {
      self.postMessage({ type: "error", id, payload: { message: err.message } });
    }
    return;
  }

  if (type === "translate") {
    if (!generator) {
      self.postMessage({ type: "error", id, payload: { message: "Model not loaded" } });
      return;
    }
    try {
      const { text, srcName, tgtName } = payload;
      const messages = [
        { role: "system", content: `You are a professional translator. Translate from ${srcName} to ${tgtName}. Output only the translation, no explanations, no notes.` },
        { role: "user", content: text },
      ];
      const out = await generator(messages, { max_new_tokens: 512, temperature: 0.1, do_sample: false });
      const generated = out[0].generated_text;
      const reply = Array.isArray(generated)
        ? generated[generated.length - 1].content
        : generated;
      self.postMessage({ type: "translated", id, payload: { translation: reply.trim() } });
    } catch (err) {
      self.postMessage({ type: "error", id, payload: { message: err.message } });
    }
  }
};
