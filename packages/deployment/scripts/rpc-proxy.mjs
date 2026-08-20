import { createServer } from "node:http";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ALLOWED = new Set([
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
]);

const MAINNET_CHAIN_IDS = new Set([
  1, 10, 8453, 42161, 534352, 59144, 130, 480, 57073, 1868, 34443,
]);
const upstream = process.env.UPSTREAM_RPC_URL ?? "";
const expected = Number(process.env.EXPECTED_CHAIN_ID ?? "0");
const journalPath = process.env.JOURNAL_PATH ?? "/journal/rpc.jsonl";
const maxBody = Number(process.env.MAX_BODY_BYTES ?? "1048576");
const rateLimit = Number(process.env.RATE_LIMIT ?? "120");
const timeoutMs = Number(process.env.TIMEOUT_MS ?? "30000");
const port = Number(process.env.LISTEN_PORT ?? "8545");

if (upstream === "" || !Number.isInteger(expected) || expected <= 0) {
  process.stderr.write("UPSTREAM_RPC_URL and EXPECTED_CHAIN_ID are required\n");
  process.exit(1);
}
if (MAINNET_CHAIN_IDS.has(expected)) {
  process.stderr.write("MAINNET_DEPLOYMENT_FORBIDDEN\n");
  process.exit(1);
}

const chainId = await rpc("eth_chainId", []);
const numeric = Number(BigInt(chainId));
if (numeric !== expected) {
  process.stderr.write(`chain id mismatch: rpc=${numeric} expected=${expected}\n`);
  process.exit(1);
}
if (MAINNET_CHAIN_IDS.has(numeric)) {
  process.stderr.write("MAINNET_DEPLOYMENT_FORBIDDEN\n");
  process.exit(1);
}

const hits = [];
const server = createServer((req, res) => {
  void onRequest(req, res);
});
server.listen(port, "0.0.0.0", () => {
  process.stdout.write(`chainport-rpc-proxy ready chainId=${expected}\n`);
});

async function onRequest(req, res) {
  if (req.method !== "POST") {
    json(res, 405, error(null, -32600, "POST only"));
    return;
  }
  const now = Date.now();
  while (hits.length > 0 && now - hits[0] > 60_000) hits.shift();
  if (hits.length >= rateLimit) {
    json(res, 429, error(null, -32005, "rate limited"));
    return;
  }
  hits.push(now);
  let raw = "";
  try {
    raw = await readBody(req, maxBody);
  } catch {
    json(res, 413, error(null, -32600, "payload too large"));
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    json(res, 400, error(null, -32700, "parse error"));
    return;
  }
  const method = typeof parsed.method === "string" ? parsed.method : "";
  const entry = { method, at: new Date().toISOString(), blocked: false };
  if (!ALLOWED.has(method)) {
    entry.blocked = true;
    await journal(entry);
    json(res, 200, error(parsed.id ?? null, -32601, `method ${method} is not allowed`));
    return;
  }
  if (method === "eth_sendRawTransaction" && Array.isArray(parsed.params)) {
    entry.rawTx = parsed.params[0];
  }
  await journal(entry);
  try {
    const upstreamRes = await fetch(upstream, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw,
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await upstreamRes.text();
    res.statusCode = upstreamRes.status;
    res.setHeader("content-type", "application/json");
    res.end(text);
  } catch (err) {
    json(
      res,
      502,
      error(parsed.id ?? null, -32000, err instanceof Error ? err.message : "upstream failed"),
    );
  }
}

async function rpc(method, params) {
  const response = await fetch(upstream, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await response.json();
  if (body.error) throw new Error(body.error.message ?? "rpc error");
  return body.result;
}

async function journal(entry) {
  await mkdir(path.dirname(journalPath), { recursive: true });
  await appendFile(journalPath, `${JSON.stringify(entry)}\n`, "utf8");
}

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > max) {
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

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function error(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
