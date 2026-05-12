"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { MLCEngineInterface } from "@mlc-ai/web-llm";
import { LANGUAGES, langCode, availableFor } from "@/lib/languages";
import { ONNX_MODELS, BENCHMARK_TABLE, DEFAULT_MODEL, type TranslatorModel } from "@/lib/models";
import { useContributorNode } from "@/hooks/useContributorNode";

type Status = "idle" | "loading" | "ready" | "translating" | "error";
type ProgressItem = { file: string; status: string; progress: number };

const NODE_PREFIX = "node-";

function getApiBase(): string {
  const ws = process.env.NEXT_PUBLIC_NODE_SERVER_URL ?? "ws://localhost:3001/node";
  return ws.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://").replace(/\/node$/, "");
}

function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return <div className={`${className} border-2 border-current border-t-transparent rounded-full animate-spin opacity-60`} />;
}

function IconSwap() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  );
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

const NODE_STATUS_LABEL: Record<string, string> = {
  off: "Contribute", connecting: "Connecting…", idle: "Contributing",
  translating: "Translating for API…", error: "Connection error",
};
const NODE_STATUS_COLOR: Record<string, string> = {
  off: "bg-slate-100 text-slate-600 hover:bg-slate-200",
  connecting: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  idle: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  translating: "bg-blue-50 text-blue-700 border border-blue-200",
  error: "bg-red-50 text-red-700 border border-red-200",
};

function AvgScore({ value }: { value: number }) {
  const pct = (value / 10) * 100;
  const bar = value >= 7.5 ? "bg-emerald-400" : value >= 6.5 ? "bg-amber-400" : "bg-orange-400";
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-xs font-mono font-semibold text-slate-700">{value.toFixed(1)}</span>
      <div className="w-10 bg-slate-100 rounded-full h-1">
        <div className={`${bar} h-1 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Model Picker ──────────────────────────────────────────────────────────────

type SortKey = "accuracy" | "size";

function sortModels(models: TranslatorModel[], key: SortKey): TranslatorModel[] {
  if (key === "accuracy") return [...models].sort((a, b) => b.score.accuracy - a.score.accuracy);
  // parse size string like "~0.7 GB" → number in GB
  const gb = (m: TranslatorModel) => parseFloat(m.sizeHuman.replace(/[^0-9.]/g, "")) || 0;
  return [...models].sort((a, b) => gb(a) - gb(b));
}

function ModelPicker({
  selected, onChange, hasWebGPU, ollamaOnline,
}: {
  selected: TranslatorModel;
  onChange: (m: TranslatorModel) => void;
  hasWebGPU: boolean | null;
  ollamaOnline: boolean | null;
}) {
  const [open, setOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("accuracy");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOut = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, []);

  const isWebGPU = selected.backend === "mlc" || selected.backend === "onnx-webgpu";
  const isOllama = selected.backend === "ollama";
  const onnxModels   = sortModels(ONNX_MODELS.filter(m => m.backend === "onnx"), sortKey);
  const gpuModels    = sortModels(ONNX_MODELS.filter(m => m.backend === "mlc" || m.backend === "onnx-webgpu"), sortKey);
  const ollamaModels = sortModels(ONNX_MODELS.filter(m => m.backend === "ollama"), sortKey);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors shadow-sm"
      >
        {isWebGPU && <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">WebGPU</span>}
        {isOllama && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Server</span>}
        <span className="text-base leading-none">{selected.score.badge}</span>
        <span>{selected.name}</span>
        <span className="text-slate-400 text-xs">·</span>
        <span className="text-slate-500 text-xs font-mono">{selected.score.avg.toFixed(1)}</span>
        <span className="text-slate-400 text-xs">·</span>
        <span className="text-slate-500 text-xs">{selected.langCount} langs</span>
        <span className="text-slate-400 text-xs">·</span>
        <span className="text-slate-400 text-xs">{selected.sizeHuman}</span>
        <IconChevron open={open} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden min-w-[700px]">

          {/* ONNX / WASM section */}
          <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">ONNX — Universal (WASM)</span>
            <span className="text-[10px] text-slate-400">works on any browser · no GPU needed</span>
          </div>
          <ModelRows models={onnxModels} selected={selected} onChange={m => { onChange(m); setOpen(false); }} sortKey={sortKey} onSortChange={setSortKey} />

          {/* WebGPU section */}
          <div className="px-4 py-2 border-b border-slate-100 bg-violet-50/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">WebGPU</span>
              <span className="text-[10px] font-semibold text-violet-700 uppercase tracking-wider">In-browser GPU models</span>
            </div>
            <span className={`text-[10px] font-medium ${hasWebGPU === true ? "text-emerald-600" : hasWebGPU === false ? "text-red-500" : "text-slate-400"}`}>
              {hasWebGPU === true ? "✓ WebGPU detected" : hasWebGPU === false ? "✗ not available" : "detecting…"}
            </span>
          </div>
          <ModelRows models={gpuModels} selected={selected} onChange={m => { onChange(m); setOpen(false); }} dimmed={hasWebGPU === false} sortKey={sortKey} onSortChange={setSortKey} />

          {/* Ollama server section */}
          <div className="px-4 py-2 border-b border-slate-100 bg-emerald-50/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Server</span>
              <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">Ollama — self-hosted large models</span>
            </div>
            <span className={`text-[10px] font-medium ${ollamaOnline === true ? "text-emerald-600" : ollamaOnline === false ? "text-red-500" : "text-slate-400"}`}>
              {ollamaOnline === true ? "✓ server online" : ollamaOnline === false ? "✗ server offline" : "checking…"}
            </span>
          </div>
          <ModelRows models={ollamaModels} selected={selected} onChange={m => { onChange(m); setOpen(false); }} dimmed={ollamaOnline === false} sortKey={sortKey} onSortChange={setSortKey} />
        </div>
      )}
    </div>
  );
}

function ModelRows({
  models, selected, onChange, dimmed = false, sortKey, onSortChange,
}: {
  models: TranslatorModel[];
  selected: TranslatorModel;
  onChange: (m: TranslatorModel) => void;
  dimmed?: boolean;
  sortKey: SortKey;
  onSortChange: (k: SortKey) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-[1fr_56px_56px_56px_48px_72px] gap-x-3 px-4 py-1.5 border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
        <span>Model</span>
        <span className={`text-right cursor-pointer select-none hover:text-slate-600 ${sortKey === "accuracy" ? "text-blue-500" : ""}`} onClick={() => onSortChange("accuracy")}>
          Accuracy {sortKey === "accuracy" ? "↓" : ""}
        </span>
        <span className="text-right">Avg</span>
        <span className="text-right">Fluency</span>
        <span className="text-right">Langs</span>
        <span className={`text-right cursor-pointer select-none hover:text-slate-600 ${sortKey === "size" ? "text-blue-500" : ""}`} onClick={() => onSortChange("size")}>
          Size {sortKey === "size" ? "↑" : ""}
        </span>
      </div>
      {models.map(m => (
        <button
          key={m.id}
          onClick={() => onChange(m)}
          className={`w-full grid grid-cols-[1fr_56px_56px_56px_48px_72px] gap-x-3 items-center px-4 py-3 text-left transition-colors border-b border-slate-50 last:border-0 ${
            m.id === selected.id ? "bg-blue-50/60" : dimmed ? "opacity-50 hover:bg-slate-50" : "hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm leading-none shrink-0">{m.score.badge}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-medium text-slate-800">{m.name}</span>
                {m.backend === "onnx-webgpu" && <span className="text-[9px] font-semibold bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full shrink-0">ONNX</span>}
                {m.backend === "mlc"          && <span className="text-[9px] font-semibold bg-violet-50 text-violet-600 border border-violet-100 px-1.5 py-0.5 rounded-full shrink-0">MLC</span>}
                {m.backend === "ollama"       && <span className="text-[9px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded-full shrink-0">Ollama</span>}
                {m.id === selected.id && <span className="text-[10px] text-blue-600 font-medium shrink-0">active</span>}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">{m.description}</p>
            </div>
          </div>
          <div className="flex justify-end"><AvgScore value={m.score.accuracy} /></div>
          <span className="text-xs font-mono text-slate-600 text-right">{m.score.avg.toFixed(1)}</span>
          <span className="text-xs font-mono text-slate-600 text-right">{m.score.fluency.toFixed(1)}</span>
          <span className="text-xs font-mono text-slate-500 text-right">{m.langCount}</span>
          <span className="text-xs text-slate-400 text-right">{m.sizeHuman}</span>
        </button>
      ))}
    </>
  );
}

// ── Benchmark Table ───────────────────────────────────────────────────────────

function BenchmarkTable() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-slate-700">Translation Quality Benchmark</span>
          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{BENCHMARK_TABLE.length} models</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <span className="text-xs">Avg · Accuracy · Fluency · Style</span>
          <IconChevron open={open} />
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wide text-[10px] font-semibold">
                <th className="text-left px-4 py-2.5 w-8">#</th>
                <th className="text-left px-3 py-2.5">Model</th>
                <th className="text-right px-3 py-2.5">Avg</th>
                <th className="text-right px-3 py-2.5">Accuracy</th>
                <th className="text-right px-3 py-2.5">Fluency</th>
                <th className="text-right px-3 py-2.5">Style</th>
                <th className="text-right px-3 py-2.5">Langs</th>
                <th className="text-right px-3 py-2.5">Obs</th>
                <th className="text-right px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {BENCHMARK_TABLE.map(row => (
                <tr key={row.rank} className={`border-t border-slate-100 hover:bg-slate-50/50 ${row.local ? "bg-blue-50/40" : ""}`}>
                  <td className="px-4 py-2.5 text-slate-400 font-mono">{row.rank}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span>{row.badge}</span>
                      <span className={`font-medium ${row.local ? "text-blue-700" : "text-slate-700"}`}>{row.model}</span>
                      {row.local && <span className="text-[9px] font-semibold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full uppercase tracking-wide">local</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-700">{row.avg.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-600">{row.accuracy.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-600">{row.fluency.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-600">{row.style.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-500">{row.langs}</td>
                  <td className="px-3 py-2.5 text-right text-slate-400">{row.obs}</td>
                  <td className="px-4 py-2.5 text-right">
                    {row.verified ? <span className="text-emerald-600 font-medium">verified</span> : <span className="text-slate-400">self-reported</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-4 text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="text-[9px] font-semibold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full uppercase tracking-wide">local</span>
              runs on-device — no server, no API key
            </span>
            <span>⚡ = WebGPU accelerated</span>
          </div>
        </div>
      )}
    </div>
  );
}

function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>\n*/g, "").trim();
}

// ── Main Translator ───────────────────────────────────────────────────────────

export default function Translator() {
  const [activeModel, setActiveModel] = useState<TranslatorModel>(() => {
    if (typeof window === "undefined") return DEFAULT_MODEL;
    const id = new URLSearchParams(window.location.search).get("model");
    return (id && ONNX_MODELS.find(m => m.id === id)) || DEFAULT_MODEL;
  });
  const [sourceText, setSourceText]       = useState("");
  const [outputText, setOutputText]       = useState("");
  const [sourceLang, setSourceLang]       = useState("eng_Latn");
  const [targetLang, setTargetLang]       = useState("fra_Latn");
  const [status, setStatus]               = useState<Status>("idle");
  const [error, setError]                 = useState("");
  const [copied, setCopied]               = useState(false);
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  const [mlcProgress, setMlcProgress]     = useState(0);
  const [mlcProgressText, setMlcProgressText] = useState("");
  const [hasWebGPU, setHasWebGPU]         = useState<boolean | null>(null);
  const [ollamaOnline, setOllamaOnline]   = useState<boolean | null>(null);

  const workerRef    = useRef<Worker | null>(null);
  const tgWorkerRef  = useRef<Worker | null>(null);
  const mlcEngineRef = useRef<MLCEngineInterface | null>(null);
  const mlcWorkerRef = useRef<Worker | null>(null);
  const reqId        = useRef(0);
  const translateRef = useRef<() => void>(() => {});

  const contributor = useContributorNode(workerRef);

  useEffect(() => {
    setHasWebGPU(typeof navigator !== "undefined" && "gpu" in navigator);
  }, []);

  // Check Ollama server availability
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${getApiBase()}/ollama/health`, { signal: AbortSignal.timeout(4000) });
        setOllamaOnline(res.ok);
      } catch {
        setOllamaOnline(false);
      }
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Sync ?model= URL param whenever active model changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("model", activeModel.id);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [activeModel]);

  const langTypeForModel =
    activeModel.backend === "mlc" || activeModel.backend === "onnx-webgpu" || activeModel.backend === "ollama"
      ? "ollama" as const
      : (activeModel.langType ?? "nllb");

  const activeLangs    = LANGUAGES.filter(l => availableFor(l, langTypeForModel));
  const safeSourceLang = activeLangs.some(l => l.code === sourceLang) ? sourceLang : activeLangs[0].code;
  const safeTargetLang = activeLangs.some(l => l.code === targetLang) ? targetLang : activeLangs[1].code;

  // ── Init ONNX WASM worker ───────────────────────────────────────────────────
  const initWorker = useCallback((model: TranslatorModel) => {
    if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }

    const worker = new Worker(new URL("../app/worker.js", import.meta.url), { type: "module" });
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (typeof msg.id === "string" && msg.id.startsWith(NODE_PREFIX)) return;
      if (msg.type === "progress") {
        const p: ProgressItem = msg.payload;
        if (p.status === "progress") {
          setProgressItems(prev => {
            const idx = prev.findIndex(x => x.file === p.file);
            if (idx >= 0) { const next = [...prev]; next[idx] = p; return next; }
            return [...prev, p];
          });
        }
      }
      if (msg.type === "loaded")     { setStatus("ready"); setProgressItems([]); }
      if (msg.type === "translated") { setOutputText(msg.payload.translation); setStatus("ready"); }
      if (msg.type === "error")      { setError(msg.payload.message); setStatus("error"); }
    };
    worker.addEventListener("message", handler);
    workerRef.current = worker;
    setStatus("loading");
    setOutputText("");
    setProgressItems([]);
    worker.postMessage({ type: "load", id: 0, payload: { modelId: model.id } });
    return () => { worker.removeEventListener("message", handler); worker.terminate(); };
  }, []);

  // ── Init ONNX WebGPU text-generation worker ─────────────────────────────────
  const initTgWorker = useCallback((model: TranslatorModel) => {
    if (tgWorkerRef.current) { tgWorkerRef.current.terminate(); tgWorkerRef.current = null; }

    const worker = new Worker(new URL("../app/tg-worker.js", import.meta.url), { type: "module" });
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "progress") {
        const p: ProgressItem = msg.payload;
        if (p.status === "progress") {
          setProgressItems(prev => {
            const idx = prev.findIndex(x => x.file === p.file);
            if (idx >= 0) { const next = [...prev]; next[idx] = p; return next; }
            return [...prev, p];
          });
        }
      }
      if (msg.type === "loaded")     { setStatus("ready"); setProgressItems([]); }
      if (msg.type === "translated") { setOutputText(msg.payload.translation); setStatus("ready"); }
      if (msg.type === "error")      { setError(msg.payload.message); setStatus("error"); }
    };
    worker.addEventListener("message", handler);
    tgWorkerRef.current = worker;
    setStatus("loading");
    setOutputText("");
    setProgressItems([]);
    worker.postMessage({ type: "load", id: 0, payload: { modelId: model.id } });
    return () => { worker.removeEventListener("message", handler); worker.terminate(); };
  }, []);

  // ── Init MLC engine ─────────────────────────────────────────────────────────
  const initMlcEngine = useCallback((model: TranslatorModel) => {
    let cancelled = false;
    setStatus("loading");
    setOutputText("");
    setMlcProgress(0);
    setMlcProgressText("Initializing…");

    (async () => {
      try {
        const { CreateWebWorkerMLCEngine, prebuiltAppConfig } = await import("@mlc-ai/web-llm");
        if (cancelled) return;

        // Gemma 3 1B ships with both context_window_size and sliding_window_size
        // set to positive values, which web-llm rejects. Patch sliding_window_size to -1.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const appConfig: any = model.id === "gemma3-1b-it-q4f16_1-MLC"
          ? {
              ...prebuiltAppConfig,
              model_list: prebuiltAppConfig.model_list.map((m: { model_id: string; overrides?: Record<string, unknown> }) =>
                m.model_id === "gemma3-1b-it-q4f16_1-MLC"
                  ? { ...m, overrides: { ...m.overrides, sliding_window_size: -1 } }
                  : m
              ),
            }
          : undefined;

        mlcWorkerRef.current = new Worker(
          new URL("../app/mlc-worker.js", import.meta.url),
          { type: "module" }
        );

        const engine = await CreateWebWorkerMLCEngine(
          mlcWorkerRef.current,
          model.id,
          {
            initProgressCallback: (p: { progress: number; text: string }) => {
              if (cancelled) return;
              setMlcProgress(Math.round(p.progress * 100));
              setMlcProgressText(p.text ?? "");
              if (p.progress >= 1) { setStatus("ready"); setMlcProgressText(""); }
            },
            ...(appConfig ? { appConfig } : {}),
          }
        );

        if (!cancelled) { mlcEngineRef.current = engine; setStatus("ready"); }
      } catch (err: unknown) {
        if (!cancelled) { setError(err instanceof Error ? err.message : String(err)); setStatus("error"); }
      }
    })();

    return () => {
      cancelled = true;
      mlcEngineRef.current?.unload().catch(() => {});
      mlcEngineRef.current = null;
      mlcWorkerRef.current?.terminate();
      mlcWorkerRef.current = null;
    };
  }, []);

  // ── Switch model ────────────────────────────────────────────────────────────
  useEffect(() => {
    setError("");
    mlcEngineRef.current?.unload().catch(() => {});
    mlcEngineRef.current = null;
    mlcWorkerRef.current?.terminate();
    mlcWorkerRef.current = null;

    if (activeModel.backend === "onnx") {
      if (tgWorkerRef.current) { tgWorkerRef.current.terminate(); tgWorkerRef.current = null; }
      return initWorker(activeModel);
    } else if (activeModel.backend === "onnx-webgpu") {
      if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }
      return initTgWorker(activeModel);
    } else if (activeModel.backend === "ollama") {
      if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }
      if (tgWorkerRef.current) { tgWorkerRef.current.terminate(); tgWorkerRef.current = null; }
      setStatus("ready");
    } else {
      if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }
      if (tgWorkerRef.current) { tgWorkerRef.current.terminate(); tgWorkerRef.current = null; }
      return initMlcEngine(activeModel);
    }
  }, [activeModel, initWorker, initTgWorker, initMlcEngine]);

  const handleModelChange = useCallback((model: TranslatorModel) => {
    setActiveModel(model);
    setError("");
  }, []);

  // ── Translate ────────────────────────────────────────────────────────────────
  const translate = useCallback(async () => {
    if (status !== "ready" || !sourceText.trim()) return;
    setStatus("translating");

    if (activeModel.backend === "mlc") {
      if (!mlcEngineRef.current) { setStatus("ready"); return; }
      const srcName = LANGUAGES.find(l => l.code === safeSourceLang)?.name ?? safeSourceLang;
      const tgtName = LANGUAGES.find(l => l.code === safeTargetLang)?.name ?? safeTargetLang;
      const isQwen = activeModel.id.toLowerCase().startsWith("qwen");
      const systemMsg = isQwen
        ? `/no_think You are a professional translator. Translate the text from ${srcName} to ${tgtName}. Output ONLY the translation, no explanations, no notes.`
        : `You are a professional translator. Translate the text from ${srcName} to ${tgtName}. Output ONLY the translation, no explanations, no notes.`;
      try {
        const reply = await mlcEngineRef.current.chat.completions.create({
          messages: [
            { role: "system", content: systemMsg },
            { role: "user",   content: sourceText.trim() },
          ],
          temperature: 0.1,
          max_tokens: 1024,
          stream: false,
        });
        const raw = reply.choices[0].message.content?.trim() ?? "";
        setOutputText(stripThinking(raw));
        setStatus("ready");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
      return;
    }

    if (activeModel.backend === "onnx-webgpu") {
      if (!tgWorkerRef.current) { setStatus("ready"); return; }
      const srcName = LANGUAGES.find(l => l.code === safeSourceLang)?.name ?? safeSourceLang;
      const tgtName = LANGUAGES.find(l => l.code === safeTargetLang)?.name ?? safeTargetLang;
      tgWorkerRef.current.postMessage({
        type: "translate",
        id: ++reqId.current,
        payload: { text: sourceText.trim(), srcName, tgtName },
      });
      return;
    }

    if (activeModel.backend === "ollama") {
      const srcName = LANGUAGES.find(l => l.code === safeSourceLang)?.name ?? safeSourceLang;
      const tgtName = LANGUAGES.find(l => l.code === safeTargetLang)?.name ?? safeTargetLang;
      try {
        const res = await fetch(`${getApiBase()}/ollama/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: sourceText.trim(), srcLang: srcName, tgtLang: tgtName, model: activeModel.id }),
        });
        const data = await res.json() as { translation?: string; error?: string };
        if (!res.ok || data.error) throw new Error(data.error ?? "Server error");
        setOutputText(data.translation ?? "");
        setStatus("ready");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Ollama request failed");
        setStatus("error");
      }
      return;
    }

    // ONNX WASM
    if (!workerRef.current) { setStatus("ready"); return; }
    const srcLang = LANGUAGES.find(l => l.code === safeSourceLang)!;
    const tgtLang = LANGUAGES.find(l => l.code === safeTargetLang)!;
    workerRef.current.postMessage({
      type: "translate",
      id: ++reqId.current,
      payload: {
        text: sourceText,
        src_lang: langCode(srcLang, activeModel.langType!),
        tgt_lang: langCode(tgtLang, activeModel.langType!),
      },
    });
  }, [status, sourceText, safeSourceLang, safeTargetLang, activeModel]);

  // Keep ref current so debounce always calls latest version
  useEffect(() => { translateRef.current = translate; });

  // Auto-translate after 0.5s of no typing
  useEffect(() => {
    if (!sourceText.trim()) return;
    const timer = setTimeout(() => translateRef.current(), 500);
    return () => clearTimeout(timer);
  }, [sourceText]);

  const swap = () => {
    if (!activeLangs.some(l => l.code === targetLang)) return;
    setSourceLang(targetLang); setTargetLang(sourceLang);
    setSourceText(outputText); setOutputText(sourceText);
  };

  const copy = async () => {
    if (!outputText) return;
    await navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isWebGPUBackend = activeModel.backend === "mlc" || activeModel.backend === "onnx-webgpu";

  const overallProgress = activeModel.backend === "mlc"
    ? mlcProgress
    : progressItems.length > 0
      ? Math.round(progressItems.reduce((s, p) => s + (p.progress ?? 0), 0) / progressItems.length)
      : 0;

  const canTranslate = status === "ready" && sourceText.trim().length > 0;

  const retryLoad = () => {
    setError("");
    if (activeModel.backend === "mlc") initMlcEngine(activeModel);
    else if (activeModel.backend === "onnx-webgpu") initTgWorker(activeModel);
    else if (activeModel.backend === "ollama") setStatus("ready");
    else { setStatus("loading"); workerRef.current?.postMessage({ type: "load", id: 0, payload: { modelId: activeModel.id } }); }
  };

  return (
    <div className="space-y-4">
      {/* Model selector row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Model</span>
          <ModelPicker selected={activeModel} onChange={handleModelChange} hasWebGPU={hasWebGPU} ollamaOnline={ollamaOnline} />
        </div>
        <div className="text-xs text-slate-400 hidden sm:block">{activeModel.description}</div>
      </div>

      {/* WebGPU unavailable notice */}
      {isWebGPUBackend && hasWebGPU === false && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-start gap-2.5">
          <span className="text-base leading-none mt-0.5">⚠️</span>
          <div>
            <span className="font-semibold">WebGPU not available</span> in this browser. This model requires Chrome 113+, Edge 113+, or Safari 18+.
            <button onClick={() => handleModelChange(ONNX_MODELS[0])} className="ml-2 underline hover:no-underline font-medium">Switch to ONNX</button>
          </div>
        </div>
      )}

      {/* Translation card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center border-b border-slate-200">
          <select value={safeSourceLang} onChange={e => setSourceLang(e.target.value)}
            className="flex-1 px-4 py-3 text-sm font-medium text-slate-700 bg-transparent border-none outline-none cursor-pointer hover:bg-slate-50 transition-colors">
            {activeLangs.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
          <button onClick={swap}
            className="px-4 py-3 text-slate-400 hover:text-slate-600 hover:bg-slate-50 border-x border-slate-200 transition-colors" title="Swap">
            <IconSwap />
          </button>
          <select value={safeTargetLang} onChange={e => setTargetLang(e.target.value)}
            className="flex-1 px-4 py-3 text-sm font-medium text-slate-700 bg-transparent border-none outline-none cursor-pointer hover:bg-slate-50 transition-colors">
            {activeLangs.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 divide-x divide-slate-200">
          <div className="relative flex flex-col">
            <textarea value={sourceText} onChange={e => setSourceText(e.target.value)}
              onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); translate(); } }}
              placeholder="Enter text to translate…" maxLength={5000} rows={8}
              className="w-full px-5 pt-4 pb-10 text-slate-800 text-[15px] leading-relaxed resize-none outline-none placeholder-slate-400" />
            <div className="absolute bottom-3 left-5 right-5 flex items-center justify-between">
              <span className="text-xs text-slate-400">{sourceText.length} / 5000</span>
              {sourceText && <button onClick={() => { setSourceText(""); setOutputText(""); }} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Clear</button>}
            </div>
          </div>

          <div className="relative flex flex-col bg-slate-50">
            {status === "translating" ? (
              <div className="flex-1 flex items-center justify-center min-h-[200px]">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Spinner />Translating on your device…
                </div>
              </div>
            ) : (
              <div className="px-5 pt-4 pb-10 min-h-[200px] overflow-y-auto">
                {outputText
                  ? <p className="text-slate-800 text-[15px] leading-relaxed whitespace-pre-wrap">{outputText}</p>
                  : <p className="text-slate-400 text-[15px]">Translation will appear here</p>}
              </div>
            )}
            {outputText && (
              <div className="absolute bottom-3 right-4">
                <button onClick={copy}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-sm transition-colors">
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between bg-slate-50/50">
          <span className="text-xs text-slate-400">Translates automatically · Ctrl+Enter to force</span>
          <button onClick={translate} disabled={!canTranslate}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">
            {status === "translating" ? "Translating…" : "Translate"}
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex-1">
          {status === "loading" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600">
                  <Spinner className="w-3.5 h-3.5 text-blue-500" />
                  {activeModel.backend === "mlc"
                    ? (mlcProgressText || `Loading ${activeModel.name} via WebGPU…`)
                    : `Downloading ${activeModel.name} (${activeModel.sizeHuman}) via WebGPU — cached after first load`}
                </span>
                {overallProgress > 0 && <span className="text-slate-400 text-xs font-mono">{overallProgress}%</span>}
              </div>
              {overallProgress > 0 && (
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all ${activeModel.backend === "mlc" ? "bg-violet-500" : "bg-blue-500"}`}
                    style={{ width: `${overallProgress}%` }} />
                </div>
              )}
            </div>
          )}

          {status === "ready" && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="w-2 h-2 bg-emerald-500 rounded-full" />
              {activeModel.backend === "ollama"
                ? <>{activeModel.name} · <span className="text-xs text-slate-400">via Ollama server</span></>
                : <>{activeModel.name} ready</>
              }
              {isWebGPUBackend
                ? <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">WebGPU</span>
                : activeModel.backend === "ollama"
                  ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Server</span>
                  : <span className="text-xs text-slate-400">· WASM · zero data sharing</span>}
            </div>
          )}

          {status === "translating" && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Spinner className="w-3.5 h-3.5 text-blue-500" />
              {activeModel.backend === "ollama" ? "Sending to Ollama server…" : "Running inference locally…"}
            </div>
          )}

          {status === "error" && (
            <div className="text-sm text-red-600">
              {error}
              <button onClick={retryLoad} className="ml-3 underline hover:no-underline">Retry</button>
            </div>
          )}
        </div>

        {status === "ready" && activeModel.backend === "onnx" && (
          <div className="flex items-center gap-3 shrink-0">
            {contributor.jobsDone > 0 && <span className="text-xs text-slate-400">{contributor.jobsDone} translated for API</span>}
            <button
              onClick={contributor.status === "off" || contributor.status === "error" ? contributor.connect : contributor.disconnect}
              disabled={contributor.status === "connecting"}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${NODE_STATUS_COLOR[contributor.status]}`}
            >
              {contributor.status === "connecting"  && <Spinner className="w-3 h-3" />}
              {contributor.status === "idle"         && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
              {contributor.status === "translating"  && <Spinner className="w-3 h-3" />}
              {NODE_STATUS_LABEL[contributor.status]}
            </button>
          </div>
        )}
      </div>

      <BenchmarkTable />

      <div className="grid grid-cols-3 gap-4">
        {[
          { title: "100% Free, forever",   body: "No API key, no account, no limits." },
          { title: "Completely private",    body: "Text never leaves your browser. Zero tracking." },
          { title: "ONNX + WebGPU",         body: "Universal WASM fallback or GPU-accelerated latest models." },
        ].map(c => (
          <div key={c.title} className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700">{c.title}</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
