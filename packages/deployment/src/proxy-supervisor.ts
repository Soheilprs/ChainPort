import { chmod, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createId } from "@chainport/shared";
import { runDocker } from "@chainport/sandbox";

import { DeploymentEngineError } from "./errors.js";

export interface RpcProxyHandle {
  containerName: string;
  isoNetwork: string;
  egressNetwork: string;
  alias: string;
  journalPath: string;
}

const SCRIPT = path.join(fileURLToPath(new URL(".", import.meta.url)), "../scripts/rpc-proxy.mjs");

export async function startRpcProxy(input: {
  upstreamRpcUrl: string;
  expectedChainId: number;
  targetChainKey: string;
  journalDir: string;
  maxBodyBytes: number;
  rateLimit: number;
  timeoutMs: number;
  extraNetworks?: readonly string[];
}): Promise<RpcProxyHandle> {
  if (input.expectedChainId === 1) {
    throw new DeploymentEngineError("MAINNET_DEPLOYMENT_FORBIDDEN");
  }
  const id = createId();
  const isoNetwork = `chainport-deploy-iso-${id}`;
  const egressNetwork = `chainport-deploy-egress-${id}`;
  const containerName = `chainport-rpc-${id}`;
  const alias = "chainport-rpc-proxy";
  await mkdir(input.journalDir, { recursive: true });
  await chmod(input.journalDir, 0o777).catch(() => undefined);
  const journalPath = path.join(input.journalDir, "rpc.jsonl");

  await createNetwork(isoNetwork, true);
  await createNetwork(egressNetwork, false);

  const image = await resolveProxyImage();
  const extraNetworks = input.extraNetworks ?? [];
  const primaryNetwork = extraNetworks[0] ?? egressNetwork;
  const created = await runDocker(
    [
      "create",
      "--name",
      containerName,
      "--label",
      "chainport.rpc-proxy=1",
      "--network",
      primaryNetwork,
      "--add-host",
      "host.docker.internal:host-gateway",
      "--env",
      `UPSTREAM_RPC_URL=${input.upstreamRpcUrl}`,
      "--env",
      `EXPECTED_CHAIN_ID=${String(input.expectedChainId)}`,
      "--env",
      `TARGET_CHAIN_KEY=${input.targetChainKey}`,
      "--env",
      "JOURNAL_PATH=/journal/rpc.jsonl",
      "--env",
      `MAX_BODY_BYTES=${String(input.maxBodyBytes)}`,
      "--env",
      `RATE_LIMIT=${String(input.rateLimit)}`,
      "--env",
      `TIMEOUT_MS=${String(input.timeoutMs)}`,
      "--mount",
      `type=bind,src=${input.journalDir},dst=/journal`,
      ...(image === "node:22-alpine"
        ? ["--mount", `type=bind,src=${SCRIPT},dst=/app/rpc-proxy.mjs,readonly`]
        : []),
      image,
      ...(image === "node:22-alpine" ? ["node", "/app/rpc-proxy.mjs"] : []),
    ],
    { timeoutMs: 30_000 },
  );
  if (created.code !== 0) {
    await cleanupNetworks(isoNetwork, egressNetwork);
    throw new DeploymentEngineError("RPC_PROXY_FAILED", created.stderr.trim());
  }
  const isolated = await runDocker(
    ["network", "connect", "--alias", alias, isoNetwork, containerName],
    { timeoutMs: 15_000 },
  );
  if (isolated.code !== 0) {
    await runDocker(["rm", "-f", containerName], { timeoutMs: 15_000 });
    await cleanupNetworks(isoNetwork, egressNetwork);
    throw new DeploymentEngineError("RPC_PROXY_FAILED", isolated.stderr.trim());
  }
  if (primaryNetwork !== egressNetwork) {
    const egressConnect = await runDocker(["network", "connect", egressNetwork, containerName], {
      timeoutMs: 15_000,
    });
    if (egressConnect.code !== 0 && !egressConnect.stderr.includes("already exists")) {
      await runDocker(["rm", "-f", containerName], { timeoutMs: 15_000 });
      await cleanupNetworks(isoNetwork, egressNetwork);
      throw new DeploymentEngineError("RPC_PROXY_FAILED", egressConnect.stderr.trim());
    }
  }
  for (const extra of extraNetworks.slice(1)) {
    const extraConnect = await runDocker(["network", "connect", extra, containerName], {
      timeoutMs: 15_000,
    });
    if (extraConnect.code !== 0 && !extraConnect.stderr.includes("already exists")) {
      await runDocker(["rm", "-f", containerName], { timeoutMs: 15_000 });
      await cleanupNetworks(isoNetwork, egressNetwork);
      throw new DeploymentEngineError("RPC_PROXY_FAILED", extraConnect.stderr.trim());
    }
  }
  const started = await runDocker(["start", containerName], { timeoutMs: 15_000 });
  if (started.code !== 0) {
    await runDocker(["rm", "-f", containerName], { timeoutMs: 15_000 });
    await cleanupNetworks(isoNetwork, egressNetwork);
    throw new DeploymentEngineError("RPC_PROXY_FAILED", started.stderr.trim());
  }
  await waitForProxyReady(containerName);
  return { containerName, isoNetwork, egressNetwork, alias, journalPath };
}

export async function stopRpcProxy(handle: RpcProxyHandle): Promise<void> {
  await runDocker(["rm", "-f", handle.containerName], { timeoutMs: 20_000 });
  await cleanupNetworks(handle.isoNetwork, handle.egressNetwork);
}

async function createNetwork(name: string, internal: boolean): Promise<void> {
  const args = ["network", "create", "--driver", "bridge"];
  if (internal) {
    args.push("--internal");
  }
  args.push(name);
  const created = await runDocker(args, { timeoutMs: 15_000 });
  if (created.code !== 0 && !created.stderr.includes("already exists")) {
    throw new DeploymentEngineError("RPC_PROXY_FAILED", created.stderr.trim());
  }
}

async function cleanupNetworks(iso: string, egress: string): Promise<void> {
  await runDocker(["network", "rm", iso], { timeoutMs: 15_000 });
  await runDocker(["network", "rm", egress], { timeoutMs: 15_000 });
}

async function resolveProxyImage(): Promise<string> {
  const tagged = await runDocker(["image", "inspect", "chainport/rpc-proxy:1"], {
    timeoutMs: 10_000,
  });
  if (tagged.code === 0) {
    return "chainport/rpc-proxy:1";
  }
  return "node:22-alpine";
}

async function waitForProxyReady(containerName: string): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const logs = await runDocker(["logs", containerName], { timeoutMs: 5_000 });
    if (logs.stdout.includes("chainport-rpc-proxy ready")) {
      return;
    }
    if (
      logs.stderr.includes("MAINNET_DEPLOYMENT_FORBIDDEN") ||
      logs.stderr.includes("chain id mismatch")
    ) {
      throw new DeploymentEngineError(
        logs.stderr.includes("MAINNET") ? "MAINNET_DEPLOYMENT_FORBIDDEN" : "CHAIN_ID_MISMATCH",
        logs.stderr.trim(),
      );
    }
    const inspect = await runDocker(
      ["inspect", "--format", "{{.State.Running}} {{.State.ExitCode}}", containerName],
      { timeoutMs: 5_000 },
    );
    if (inspect.stdout.trim().startsWith("false") && inspect.stdout.trim() !== "false 0") {
      throw new DeploymentEngineError("RPC_PROXY_FAILED", logs.stderr.trim() || logs.stdout.trim());
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new DeploymentEngineError("RPC_PROXY_FAILED", "proxy did not become ready");
}
