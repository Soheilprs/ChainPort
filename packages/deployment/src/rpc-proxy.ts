import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export const ALLOWED_RPC_METHODS = [
  "eth_chainId",
  "eth_blockNumber",
  "eth_getBalance",
  "eth_getTransactionCount",
  "eth_call",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_feeHistory",
  "eth_maxPriorityFeePerGas",
  "eth_getCode",
  "eth_getTransactionReceipt",
  "eth_getTransactionByHash",
  "eth_sendRawTransaction",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "net_version",
] as const;

export type AllowedRpcMethod = (typeof ALLOWED_RPC_METHODS)[number];

export interface RpcProxyOptions {
  upstreamRpcUrl: string;
  expectedChainId: number;
  journalPath: string;
  maxBodyBytes: number;
  rateLimit: number;
  timeoutMs: number;
  listenHost?: string;
  listenPort?: number;
}

export interface RpcAudit {
  method: string;
  count: number;
}

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: unknown;
  method?: string;
  params?: unknown;
}

export function createRpcProxy(options: RpcProxyOptions): Server {
  const counts = new Map<string, number>();
  const windowHits: number[] = [];
  const server = createServer((req, res) => {
    void handle(req, res, options, counts, windowHits);
  });
  return server;
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  options: RpcProxyOptions,
  counts: Map<string, number>,
  windowHits: number[],
): Promise<void> {
  if (req.method !== "POST") {
    writeJson(res, 405, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "POST only" },
    });
    return;
  }
  const now = Date.now();
  while (windowHits.length > 0 && now - (windowHits[0] ?? 0) > 60_000) {
    windowHits.shift();
  }
  if (windowHits.length >= options.rateLimit) {
    writeJson(res, 429, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32005, message: "rate limited" },
    });
    return;
  }
  windowHits.push(now);
  let raw = "";
  try {
    raw = await readBody(req, options.maxBodyBytes);
  } catch {
    writeJson(res, 413, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "payload too large" },
    });
    return;
  }
  let parsed: JsonRpcRequest;
  try {
    parsed = JSON.parse(raw) as JsonRpcRequest;
  } catch {
    writeJson(res, 400, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "parse error" },
    });
    return;
  }
  const method = parsed.method ?? "";
  if (!(ALLOWED_RPC_METHODS as readonly string[]).includes(method)) {
    await appendJournal(options.journalPath, {
      method,
      blocked: true,
      at: new Date().toISOString(),
    });
    writeJson(res, 200, {
      jsonrpc: "2.0",
      id: parsed.id ?? null,
      error: { code: -32601, message: `method ${method} is not allowed` },
    });
    return;
  }
  counts.set(method, (counts.get(method) ?? 0) + 1);
  const journalEntry: Record<string, unknown> = {
    method,
    at: new Date().toISOString(),
    blocked: false,
  };
  if (method === "eth_sendRawTransaction") {
    const firstParam: unknown = Array.isArray(parsed.params) ? parsed.params[0] : undefined;
    if (typeof firstParam === "string") {
      journalEntry.rawTx = firstParam;
    }
  }
  await appendJournal(options.journalPath, journalEntry);
  try {
    const upstream = await fetch(options.upstreamRpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw,
      redirect: "error",
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    const text = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader("content-type", "application/json");
    res.end(text);
  } catch (error) {
    writeJson(res, 502, {
      jsonrpc: "2.0",
      id: parsed.id ?? null,
      error: { code: -32000, message: error instanceof Error ? error.message : "upstream failed" },
    });
  }
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new Error("too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function appendJournal(journalPath: string, entry: Record<string, unknown>): Promise<void> {
  await mkdir(path.dirname(journalPath), { recursive: true });
  await appendFile(journalPath, `${JSON.stringify(entry)}\n`, "utf8");
}

export function auditFromJournal(lines: string[]): RpcAudit[] {
  const counts = new Map<string, number>();
  for (const line of lines) {
    if (line.trim() === "") {
      continue;
    }
    try {
      const parsed = JSON.parse(line) as { method?: string };
      if (typeof parsed.method === "string") {
        counts.set(parsed.method, (counts.get(parsed.method) ?? 0) + 1);
      }
    } catch {
      // ignore malformed journal lines
    }
  }
  return [...counts.entries()].map(([method, count]) => ({ method, count }));
}
