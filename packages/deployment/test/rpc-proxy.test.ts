import { createServer } from "node:http";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ALLOWED_RPC_METHODS, createRpcProxy } from "../src/rpc-proxy.js";
import { redactSecrets } from "../src/redaction.js";

describe("rpc proxy", () => {
  const servers: Array<ReturnType<typeof createServer>> = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve) => {
            server.close(() => resolve());
          }),
      ),
    );
  });

  it("forwards only allowlisted methods and never uses the request URL as upstream", async () => {
    const upstream = createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk: Buffer) => {
        raw += chunk.toString("utf8");
      });
      req.on("end", () => {
        const parsed = JSON.parse(raw) as { method?: string };
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: parsed.method }));
      });
    });
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", () => resolve()));
    servers.push(upstream);
    const address = upstream.address();
    if (address === null || typeof address === "string") {
      throw new Error("no port");
    }
    const journalDir = await mkdtemp(path.join(tmpdir(), "chainport-proxy-"));
    const proxy = createRpcProxy({
      upstreamRpcUrl: `http://127.0.0.1:${address.port}`,
      expectedChainId: 11155420,
      journalPath: path.join(journalDir, "rpc.jsonl"),
      maxBodyBytes: 4096,
      rateLimit: 20,
      timeoutMs: 5_000,
    });
    await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", () => resolve()));
    servers.push(proxy);
    const proxyAddr = proxy.address();
    if (proxyAddr === null || typeof proxyAddr === "string") {
      throw new Error("no proxy port");
    }
    const allowed = await fetch(`http://127.0.0.1:${proxyAddr.port}`, {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    });
    expect(((await allowed.json()) as { result: string }).result).toBe("eth_chainId");
    const blocked = await fetch(`http://127.0.0.1:${proxyAddr.port}`, {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_sendTransaction", params: [] }),
    });
    const blockedBody = (await blocked.json()) as { error?: { message?: string } };
    expect(blockedBody.error?.message).toMatch(/not allowed/);
    expect(ALLOWED_RPC_METHODS).toContain("eth_sendRawTransaction");
    const journal = await readFile(path.join(journalDir, "rpc.jsonl"), "utf8");
    expect(journal).toContain("eth_sendTransaction");
    expect(journal).toContain('"blocked":true');
  });

  it("redacts disposable private keys from logs without erasing transaction hashes", () => {
    const key = "0x1111111111111111111111111111111111111111111111111111111111111111";
    const text = `PRIVATE_KEY=${key} hash=0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`;
    const redacted = redactSecrets(text, key);
    expect(redacted).not.toContain("11111111");
    expect(redacted).toContain("aaaaaaaaaaaaaaaa");
  });
});
