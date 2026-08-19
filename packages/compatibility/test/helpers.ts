import { snapshotForChainKey, type TargetCapabilitySnapshot } from "@chainport/chain-registry";
import type { DetectionConfidence, RequirementCategory } from "@chainport/shared";

import { evaluateCompatibility } from "../src/index.js";
import type { CompatibilityRequirement } from "../src/types.js";

let requirementSeq = 0;

export function requirement(
  input: Partial<CompatibilityRequirement> &
    Pick<CompatibilityRequirement, "key" | "detectedValue" | "normalizedValue">,
): CompatibilityRequirement {
  requirementSeq += 1;
  return {
    id: input.id ?? `req-${requirementSeq}`,
    category: input.category ?? "CONFIGURATION",
    requirementType: input.requirementType ?? input.key,
    confidence: input.confidence ?? "DETECTED",
    detector: input.detector ?? "test",
    detectorVersion: input.detectorVersion ?? "1",
    evidenceFilePaths: input.evidenceFilePaths ?? ["src/App.sol"],
    key: input.key,
    detectedValue: input.detectedValue,
    normalizedValue: input.normalizedValue,
  };
}

export function tokenReq(
  symbol: "USDC" | "USDT" | "WETH",
  address: string,
  confidence: DetectionConfidence = "DETECTED",
): CompatibilityRequirement {
  return requirement({
    category: "TOKEN",
    key: symbol,
    requirementType: "NAMED_ADDRESS",
    detectedValue: address,
    normalizedValue: symbol,
    confidence,
  });
}

export function chainIdReq(chainId: string, file = "hardhat.config.ts"): CompatibilityRequirement {
  return requirement({
    category: "NETWORK",
    key: "HARDCODED_CHAIN_ID",
    requirementType: "CHAIN_ID",
    detectedValue: chainId,
    normalizedValue: chainId,
    evidenceFilePaths: [file],
  });
}

export function rpcMethodReq(method: string): CompatibilityRequirement {
  return requirement({
    category: "RPC",
    key: "RPC_METHOD",
    requirementType: "JSON_RPC",
    detectedValue: method,
    normalizedValue: method,
  });
}

export function protocolReq(
  key: string,
  category: RequirementCategory = "PROTOCOL",
): CompatibilityRequirement {
  return requirement({
    category,
    key,
    requirementType: "PROTOCOL",
    detectedValue: key,
    normalizedValue: key,
  });
}

export function evaluateAgainst(
  targetChainKey: string,
  requirements: CompatibilityRequirement[],
  options?: {
    sourceChainKey?: string;
    sourceChainId?: number;
    sourceChainName?: string;
    snapshot?: TargetCapabilitySnapshot;
    hasSolidityContracts?: boolean;
  },
) {
  const hashed = snapshotForChainKey(targetChainKey);
  const snapshot = options?.snapshot ?? hashed.snapshot;
  return evaluateCompatibility({
    sourceChainKey: options?.sourceChainKey ?? "base",
    sourceChainId: options?.sourceChainId ?? 8453,
    sourceChainName: options?.sourceChainName ?? "Base",
    targetChainKey,
    targetChainId: snapshot.chainId,
    targetChainName: targetChainKey,
    snapshot,
    requirements,
    hasSolidityContracts: options?.hasSolidityContracts ?? false,
  });
}

export function mutateSnapshot(
  targetChainKey: string,
  mutate: (snapshot: TargetCapabilitySnapshot) => TargetCapabilitySnapshot,
): TargetCapabilitySnapshot {
  return mutate(snapshotForChainKey(targetChainKey).snapshot);
}
