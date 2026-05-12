export type LangType  = "nllb" | "m2m100";
export type Backend   = "onnx" | "mlc" | "onnx-webgpu";
export type SpeedTier = "fast" | "medium" | "slow";
export type Badge     = "🟢" | "🟡" | "🟠";

export type ModelScore = {
  avg: number;
  accuracy: number;
  fluency: number;
  style: number;
  badge: Badge;
  langCount: number;
  verified: boolean;
};

export type TranslatorModel = {
  id: string;
  backend: Backend;
  name: string;
  family: string;
  sizeHuman: string;
  langType?: LangType;   // onnx only
  langCount: number;
  speed: SpeedTier;
  description: string;
  score: ModelScore;
  default?: boolean;
};

export type BenchmarkEntry = {
  rank: number;
  model: string;
  badge: string;
  avg: number;
  accuracy: number;
  fluency: number;
  style: number;
  langs: number;
  obs: number;
  verified: boolean;
  local?: boolean;
};

export const ONNX_MODELS: TranslatorModel[] = [
  // ── ONNX (browser WASM) ────────────────────────────────────────────────────
  {
    id: "Xenova/nllb-200-distilled-600M",
    backend: "onnx",
    name: "NLLB-200 600M",
    family: "NLLB-200",
    sizeHuman: "~620 MB",
    langType: "nllb",
    langCount: 200,
    speed: "fast",
    description: "Meta's NLLB-200 distilled. Fast, offline, 200 languages.",
    score: { avg: 6.4, accuracy: 6.8, fluency: 6.6, style: 6.0, badge: "🟠", langCount: 200, verified: false },
    default: true,
  },
  {
    id: "Xenova/m2m100_418M",
    backend: "onnx",
    name: "M2M100 418M",
    family: "M2M-100",
    sizeHuman: "~430 MB",
    langType: "m2m100",
    langCount: 100,
    speed: "fast",
    description: "Meta's M2M-100. Direct many-to-many, 100 languages.",
    score: { avg: 6.8, accuracy: 7.2, fluency: 7.0, style: 6.4, badge: "🟡", langCount: 100, verified: false },
  },

  // ── MLC (WebGPU) ───────────────────────────────────────────────────────────
  // ── ONNX WebGPU (Transformers.js + WebGPU) ────────────────────────────────────
  {
    id: "onnx-community/gemma-4-E2B-it-ONNX",
    backend: "onnx-webgpu",
    name: "Gemma 4 E2B",
    family: "Gemma 4",
    sizeHuman: "~2.3 GB",
    langCount: 140,
    speed: "fast",
    description: "Google Gemma 4 E2B Instruct. Latest generation, multimodal-capable, via ONNX WebGPU.",
    score: { avg: 7.6, accuracy: 7.9, fluency: 7.8, style: 7.2, badge: "🟡", langCount: 140, verified: false },
  },
  {
    id: "onnx-community/gemma-4-E4B-it-ONNX",
    backend: "onnx-webgpu",
    name: "Gemma 4 E4B",
    family: "Gemma 4",
    sizeHuman: "~1.5 GB",
    langCount: 140,
    speed: "fast",
    description: "Google Gemma 4 E4B Instruct. 128K context, best quality in the Gemma 4 browser family.",
    score: { avg: 7.9, accuracy: 8.2, fluency: 8.0, style: 7.6, badge: "🟡", langCount: 140, verified: false },
  },

  {
    id: "gemma3-1b-it-q4f16_1-MLC",
    backend: "mlc",
    name: "Gemma 3 1B",
    family: "Gemma 3",
    sizeHuman: "~0.7 GB",
    langCount: 140,
    speed: "fast",
    description: "Google Gemma 3 1B Instruct. Fastest WebGPU model, great for quick translations.",
    score: { avg: 7.3, accuracy: 7.5, fluency: 7.6, style: 6.9, badge: "🟡", langCount: 140, verified: false },
  },
  {
    id: "Qwen3.5-0.8B-q4f16_1-MLC",
    backend: "mlc",
    name: "Qwen3.5 0.8B",
    family: "Qwen3.5",
    sizeHuman: "~1.6 GB",
    langCount: 92,
    speed: "fast",
    description: "Alibaba Qwen3.5 0.8B. Excellent multilingual quality for its size.",
    score: { avg: 7.5, accuracy: 7.8, fluency: 7.9, style: 6.9, badge: "🟡", langCount: 92, verified: false },
  },
  {
    id: "Qwen3.5-2B-q4f16_1-MLC",
    backend: "mlc",
    name: "Qwen3.5 2B",
    family: "Qwen3.5",
    sizeHuman: "~2.2 GB",
    langCount: 92,
    speed: "medium",
    description: "Alibaba Qwen3.5 2B. Best translation quality available in-browser.",
    score: { avg: 7.9, accuracy: 8.1, fluency: 8.2, style: 7.5, badge: "🟡", langCount: 92, verified: false },
  },
];

export const BENCHMARK_TABLE: BenchmarkEntry[] = [
  { rank: 1,  model: "gemini-3.1-flash-lite",                  badge: "🟡", avg: 8.2, accuracy: 8.6, fluency: 8.7, style: 8.0, langs: 45,  obs: 45,  verified: true  },
  { rank: 2,  model: "mistral-small-latest",                   badge: "🟡", avg: 7.9, accuracy: 8.1, fluency: 8.6, style: 7.7, langs: 45,  obs: 45,  verified: true  },
  { rank: 3,  model: "Qwen3.5 2B  (on-device ⚡)",             badge: "🟡", avg: 7.9, accuracy: 8.1, fluency: 8.2, style: 7.5, langs: 92,  obs: 92,  verified: false, local: true },
  { rank: 4,  model: "gemma4:31b",                             badge: "🟡", avg: 7.7, accuracy: 8.1, fluency: 8.3, style: 7.5, langs: 227, obs: 227, verified: false },
  { rank: 5,  model: "Gemma 4 E4B  (on-device ⚡)",            badge: "🟡", avg: 7.9, accuracy: 8.2, fluency: 8.0, style: 7.6, langs: 140, obs: 140, verified: false, local: true },
  { rank: 6,  model: "claude-haiku-4.5",                       badge: "🟡", avg: 7.6, accuracy: 8.1, fluency: 7.9, style: 7.2, langs: 227, obs: 227, verified: true  },
  { rank: 7,  model: "Gemma 4 E2B  (on-device ⚡)",            badge: "🟡", avg: 7.6, accuracy: 7.9, fluency: 7.8, style: 7.2, langs: 140, obs: 140, verified: false, local: true },
  { rank: 8,  model: "Qwen3.5 0.8B  (on-device ⚡)",           badge: "🟡", avg: 7.5, accuracy: 7.8, fluency: 7.9, style: 6.9, langs: 92,  obs: 92,  verified: false, local: true },
  { rank: 9,  model: "qwen3.5:35b",                            badge: "🟡", avg: 7.5, accuracy: 7.8, fluency: 8.0, style: 7.3, langs: 45,  obs: 45,  verified: false },
  { rank: 10, model: "gemma3:27b",                             badge: "🟡", avg: 7.5, accuracy: 7.8, fluency: 8.2, style: 7.2, langs: 227, obs: 227, verified: false },
  { rank: 11, model: "Gemma 3 1B  (on-device ⚡)",             badge: "🟡", avg: 7.3, accuracy: 7.5, fluency: 7.6, style: 6.9, langs: 140, obs: 140, verified: false, local: true },
  { rank: 12, model: "M2M100 418M  (on-device)",               badge: "🟡", avg: 6.8, accuracy: 7.2, fluency: 7.0, style: 6.4, langs: 100, obs: 100, verified: false, local: true },
  { rank: 13, model: "NLLB-200 600M  (on-device)",             badge: "🟠", avg: 6.4, accuracy: 6.8, fluency: 6.6, style: 6.0, langs: 200, obs: 200, verified: false, local: true },
];

export const DEFAULT_MODEL = ONNX_MODELS.find(m => m.default)!;
