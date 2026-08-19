import { CHAINS } from "./catalog.js";
import { toChainSummary, type ChainDefinition, type ChainSummary } from "./types.js";

const byKey = new Map(CHAINS.map((chain) => [chain.key, chain]));
const byChainId = new Map(CHAINS.map((chain) => [chain.chainId, chain]));

export function listChains(): readonly ChainDefinition[] {
  return CHAINS;
}

export function listChainSummaries(): readonly ChainSummary[] {
  return CHAINS.map(toChainSummary);
}

export function getChainByKey(key: string): ChainDefinition | undefined {
  return byKey.get(key);
}

export function getChainByChainId(chainId: number): ChainDefinition | undefined {
  return byChainId.get(chainId);
}

export function requireChainByKey(key: string): ChainDefinition {
  const chain = getChainByKey(key);
  if (chain === undefined) {
    throw new Error(`unknown chain key: ${key}`);
  }
  return chain;
}

export function listSourceChains(): readonly ChainDefinition[] {
  return CHAINS.filter((chain) => chain.roles.includes("source"));
}

export function listTargetChains(): readonly ChainDefinition[] {
  return CHAINS.filter((chain) => chain.roles.includes("target"));
}

export function listTestnetsFor(mainnetKey: string): readonly ChainDefinition[] {
  return CHAINS.filter((chain) => chain.testnetOf === mainnetKey);
}
