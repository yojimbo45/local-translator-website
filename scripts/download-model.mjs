/**
 * Downloads NLLB-200-distilled-600M ONNX files to public/models/.
 * Run once: npm run model:download
 * The dev server then serves them at /models/ — no CDN latency.
 */

import { mkdir, writeFile, stat } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL_ID = "Xenova/nllb-200-distilled-600M";
const DEST_DIR = join(ROOT, "public", "models", MODEL_ID);
const BASE_URL = `https://huggingface.co/${MODEL_ID}/resolve/main`;

// Only q8 files needed — used by WASM backend in local dev.
const FILES = [
  "config.json",
  "generation_config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "special_tokens_map.json",
  "sentencepiece.bpe.model",
  "onnx/encoder_model_quantized.onnx",
  "onnx/decoder_model_merged_quantized.onnx",
];

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

async function alreadyExists(dest) {
  try {
    const s = await stat(dest);
    return s.size > 0;
  } catch {
    return false;
  }
}

async function download(file) {
  const dest = join(DEST_DIR, file);
  if (await alreadyExists(dest)) {
    process.stdout.write(`  ✓ ${file} (cached)\n`);
    return;
  }

  await mkdir(dirname(dest), { recursive: true });
  process.stdout.write(`  ↓ ${file} ... `);

  const res = await fetch(`${BASE_URL}/${file}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${file}`);

  const buf = await res.arrayBuffer();
  await writeFile(dest, Buffer.from(buf));
  process.stdout.write(`${fmt(buf.byteLength)}\n`);
}

console.log(`\nDownloading ${MODEL_ID} for local dev\n`);

for (const file of FILES) {
  await download(file);
}

console.log(`\nDone. Model saved to public/models/${MODEL_ID}`);
console.log("Restart the dev server — translation will now load from disk.\n");
