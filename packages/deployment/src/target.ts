import { getChainByKey, type ChainDefinition } from "@chainport/chain-registry";
import { DEPLOYMENT_ERROR_MESSAGES } from "@chainport/shared";

import { DeploymentEngineError } from "./errors.js";
import { jsonRpc } from "./rpc.js";

export function requireDeploymentTarget(key: string): ChainDefinition {
  const chain = getChainByKey(key);
  if (chain === undefined) {
    throw new DeploymentEngineError("UNKNOWN_DEPLOYMENT_TARGET");
  }
  assertDeployableTarget(chain);
  return chain;
}

export function assertDeployableTarget(chain: ChainDefinition): void {
  if (chain.networkKind === "mainnet" || chain.deployment?.environment === "MAINNET") {
    throw new DeploymentEngineError(
      "MAINNET_DEPLOYMENT_FORBIDDEN",
      DEPLOYMENT_ERROR_MESSAGES.MAINNET_DEPLOYMENT_FORBIDDEN,
    );
  }
  if (chain.deployment === undefined || !chain.deployment.enabled) {
    throw new DeploymentEngineError("DEPLOYMENT_TARGET_DISABLED");
  }
  if (chain.deployment.environment !== "TESTNET" && chain.deployment.environment !== "DEVNET") {
    throw new DeploymentEngineError("MAINNET_DEPLOYMENT_FORBIDDEN");
  }
}

export async function confirmTargetRpc(input: {
  chain: ChainDefinition;
  rpcUrl: string;
}): Promise<number> {
  assertDeployableTarget(input.chain);
  const chainId = await jsonRpc<string>(input.rpcUrl, "eth_chainId", []);
  const numeric = Number(BigInt(chainId));
  if (!Number.isInteger(numeric) || numeric !== input.chain.chainId) {
    throw new DeploymentEngineError(
      "CHAIN_ID_MISMATCH",
      `RPC chain id ${numeric} does not match registry ${input.chain.chainId}`,
    );
  }
  return numeric;
}

export function selectUpstreamRpc(chain: ChainDefinition, override?: string): string {
  if (override !== undefined && override.trim() !== "") {
    if (chain.key !== "anvil") {
      throw new DeploymentEngineError("ARBITRARY_RPC_REJECTED");
    }
    return override;
  }
  const url = chain.rpcUrls[0];
  if (url === undefined) {
    throw new DeploymentEngineError("UNKNOWN_DEPLOYMENT_TARGET", "Registry RPC URL is missing");
  }
  return url;
}
