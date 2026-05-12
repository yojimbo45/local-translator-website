"use client";

import { useEffect, useRef, useCallback, useState } from "react";

export type ContributorStatus = "off" | "connecting" | "idle" | "translating" | "error";

const NODE_PREFIX = "node-"; // prefix for worker message IDs owned by node jobs

/**
 * Connects this browser tab as a translation node.
 * Receives jobs from the server over WebSocket, runs inference via the
 * existing shared worker, and returns results — all without extra model load.
 */
export function useContributorNode(workerRef: React.RefObject<Worker | null>) {
  const [status, setStatus]   = useState<ContributorStatus>("off");
  const [jobsDone, setJobsDone] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  // Listen for worker responses that belong to node jobs (prefixed IDs)
  const onWorkerMessage = useCallback((event: MessageEvent) => {
    const msg = event.data;
    if (typeof msg.id !== "string" || !msg.id.startsWith(NODE_PREFIX)) return;

    const jobId = msg.id.slice(NODE_PREFIX.length);
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (msg.type === "translated") {
      ws.send(JSON.stringify({ type: "result", id: jobId, translation: msg.payload.translation }));
      setJobsDone((n) => n + 1);
    } else if (msg.type === "error") {
      ws.send(JSON.stringify({ type: "error", id: jobId, message: msg.payload.message }));
    }

    setStatus("idle");
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current) return;

    const url = process.env.NEXT_PUBLIC_NODE_SERVER_URL ?? "ws://localhost:3001/node";

    setStatus("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("idle");
      // Attach worker listener now that the WS is live
      workerRef.current?.addEventListener("message", onWorkerMessage);
    };

    // Server sends a job — forward it to the local worker
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type !== "job") return;

      setStatus("translating");
      workerRef.current?.postMessage({
        type: "translate",
        id: `${NODE_PREFIX}${msg.id}`,
        payload: { text: msg.text, src_lang: msg.src_lang, tgt_lang: msg.tgt_lang },
      });
    };

    ws.onclose  = () => { setStatus("off");   wsRef.current = null; };
    ws.onerror  = () => { setStatus("error"); wsRef.current = null; };
  }, [workerRef, onWorkerMessage]);

  const disconnect = useCallback(() => {
    workerRef.current?.removeEventListener("message", onWorkerMessage);
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("off");
  }, [workerRef, onWorkerMessage]);

  // Clean up on unmount
  useEffect(() => () => {
    workerRef.current?.removeEventListener("message", onWorkerMessage);
    wsRef.current?.close();
  }, [workerRef, onWorkerMessage]);

  return { status, jobsDone, connect, disconnect };
}
