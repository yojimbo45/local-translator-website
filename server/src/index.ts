/**
 * Translation job router.
 *
 * Browser nodes connect via WebSocket (/node) and do the actual ML inference.
 * API callers send jobs via REST (/translate) — the server routes them to an
 * idle node and streams the result back. No model runs here.
 *
 * Protocol (server ↔ node):
 *   server → node  { type:"job",    id, text, src_lang, tgt_lang }
 *   node   → server { type:"result", id, translation }
 *   node   → server { type:"error",  id, message }
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";

// ── ISO 639-1 → NLLB code (used by the browser NLLB-200 model) ───────────────
const ISO_TO_NLLB: Record<string, string> = {
  en:"eng_Latn", fr:"fra_Latn", es:"spa_Latn", de:"deu_Latn", it:"ita_Latn",
  pt:"por_Latn", ru:"rus_Cyrl", zh:"zho_Hans", ja:"jpn_Jpan", ko:"kor_Hang",
  ar:"arb_Arab", hi:"hin_Deva", nl:"nld_Latn", pl:"pol_Latn", tr:"tur_Latn",
  sv:"swe_Latn", no:"nob_Latn", da:"dan_Latn", fi:"fin_Latn", el:"ell_Grek",
  cs:"ces_Latn", ro:"ron_Latn", hu:"hun_Latn", th:"tha_Thai", vi:"vie_Latn",
  id:"ind_Latn", ms:"zsm_Latn", he:"heb_Hebr", uk:"ukr_Cyrl", bg:"bul_Cyrl",
  hr:"hrv_Latn", sk:"slk_Latn", et:"est_Latn", lv:"lvs_Latn", lt:"lit_Latn",
  ca:"cat_Latn", sr:"srp_Cyrl", bn:"ben_Beng", ur:"urd_Arab", sw:"swh_Latn",
  af:"afr_Latn", fa:"pes_Arab", tl:"fil_Latn", my:"mya_Mymr", km:"khm_Khmr",
  am:"amh_Ethi",
};

// ── Types ─────────────────────────────────────────────────────────────────────
type Node = { id: string; ws: WebSocket; busy: boolean };
type PendingJob = {
  resolve: (t: string) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
  nodeId: string;
};
type QueuedJob = {
  text: string; src_lang: string; tgt_lang: string;
  resolve: (t: string) => void; reject: (e: Error) => void;
};

// ── State ─────────────────────────────────────────────────────────────────────
const nodes   = new Map<string, Node>();
const pending = new Map<string, PendingJob>();
const queue: QueuedJob[] = [];

const JOB_TIMEOUT = 30_000;
const QUEUE_LIMIT  = 50;

// ── Job routing ───────────────────────────────────────────────────────────────
function idleNode(): Node | undefined {
  for (const n of nodes.values()) if (!n.busy) return n;
}

function dispatch(job: QueuedJob): boolean {
  const node = idleNode();
  if (!node) return false;

  const id = randomUUID();
  node.busy = true;

  const timer = setTimeout(() => {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    const n = nodes.get(p.nodeId);
    if (n) n.busy = false;
    p.reject(new Error("Node timeout"));
    processQueue();
  }, JOB_TIMEOUT);

  pending.set(id, { ...job, timer, nodeId: node.id });
  node.ws.send(JSON.stringify({ type: "job", id, text: job.text, src_lang: job.src_lang, tgt_lang: job.tgt_lang }));
  return true;
}

function processQueue() {
  while (queue.length > 0 && idleNode()) {
    const job = queue.shift()!;
    dispatch(job);
  }
}

function enqueue(text: string, src_lang: string, tgt_lang: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const job: QueuedJob = { text, src_lang, tgt_lang, resolve, reject };
    if (!dispatch(job)) {
      if (queue.length >= QUEUE_LIMIT) {
        reject(new Error("Queue full — try again shortly"));
      } else {
        queue.push(job);
      }
    }
  });
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const reply = (res: ServerResponse, status: number, data: object) => {
  res.writeHead(status, CORS);
  res.end(JSON.stringify(data));
};

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => resolve(s));
    req.on("error", reject);
  });

// ── HTTP routes ───────────────────────────────────────────────────────────────
async function handleHTTP(req: IncomingMessage, res: ServerResponse) {
  const { pathname } = new URL(req.url ?? "/", `http://localhost`);

  if (req.method === "OPTIONS") { res.writeHead(204, CORS); res.end(); return; }

  // GET / — status
  if (req.method === "GET" && pathname === "/") {
    return reply(res, 200, {
      nodes: nodes.size,
      idle:  [...nodes.values()].filter(n => !n.busy).length,
      busy:  [...nodes.values()].filter(n =>  n.busy).length,
      queued: queue.length,
    });
  }

  // POST /translate
  if (req.method === "POST" && pathname === "/translate") {
    let body: { text?: string; source?: string; target?: string };
    try { body = JSON.parse(await readBody(req)); }
    catch { return reply(res, 400, { error: "Invalid JSON" }); }

    const { text, source = "en", target } = body;

    if (!text?.trim())          return reply(res, 400, { error: "text is required" });
    if (text.length > 2000)     return reply(res, 400, { error: "text exceeds 2000 chars" });
    if (!target)                return reply(res, 400, { error: "target is required" });
    if (!ISO_TO_NLLB[source])  return reply(res, 400, { error: `Unknown source language: ${source}` });
    if (!ISO_TO_NLLB[target])  return reply(res, 400, { error: `Unknown target language: ${target}` });
    if (source === target)      return reply(res, 400, { error: "source and target must differ" });
    if (nodes.size === 0)       return reply(res, 503, { error: "No nodes online — try again later" });

    try {
      const t0 = Date.now();
      const translation = await enqueue(text.trim(), ISO_TO_NLLB[source], ISO_TO_NLLB[target]);
      return reply(res, 200, { translation, source, target, ms: Date.now() - t0 });
    } catch (e: any) {
      return reply(res, 502, { error: e.message });
    }
  }

  reply(res, 404, { error: "Not found" });
}

// ── WebSocket — browser node connections ─────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3001);
const httpServer = createServer(handleHTTP);
const wss = new WebSocketServer({ server: httpServer, path: "/node" });

wss.on("connection", (ws) => {
  const id = randomUUID();
  nodes.set(id, { id, ws, busy: false });
  console.log(`+ node ${id.slice(0, 8)}  (${nodes.size} online)`);

  ws.on("message", (raw) => {
    let msg: { type: string; id: string; translation?: string; message?: string };
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    const job = pending.get(msg.id);
    if (!job) return;

    clearTimeout(job.timer);
    pending.delete(msg.id);
    const node = nodes.get(job.nodeId);
    if (node) node.busy = false;

    if (msg.type === "result" && msg.translation) {
      job.resolve(msg.translation);
    } else {
      job.reject(new Error(msg.message ?? "Node error"));
    }

    processQueue();
  });

  ws.on("close", () => {
    console.log(`- node ${id.slice(0, 8)}  (${nodes.size - 1} online)`);

    // Fail any job this node was processing so the caller gets an error fast
    for (const [jobId, job] of pending) {
      if (job.nodeId !== id) continue;
      clearTimeout(job.timer);
      pending.delete(jobId);
      job.reject(new Error("Node disconnected"));
    }

    nodes.delete(id);
    processQueue();
  });

  ws.on("error", (err) => console.error(`node ${id.slice(0, 8)} error:`, err.message));

  // Flush any queued jobs now that a new node is available
  processQueue();
});

httpServer.listen(PORT, () => {
  console.log(`\nTranslation server`);
  console.log(`  API  →  http://localhost:${PORT}/translate`);
  console.log(`  WS   →  ws://localhost:${PORT}/node`);
  console.log(`  Status → http://localhost:${PORT}/\n`);
});
