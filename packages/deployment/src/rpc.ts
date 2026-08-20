export async function jsonRpc<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
  timeoutMs = 15_000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) {
      throw new Error(`RPC HTTP ${response.status}`);
    }
    const body = (await response.json()) as { result?: T; error?: { message?: string } };
    if (body.error !== undefined) {
      throw new Error(body.error.message ?? "RPC error");
    }
    if (body.result === undefined) {
      throw new Error("RPC result missing");
    }
    return body.result;
  } finally {
    clearTimeout(timer);
  }
}
