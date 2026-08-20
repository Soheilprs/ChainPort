import type { ChainDefinition } from "@chainport/chain-registry";

import { DeploymentEngineError } from "./errors.js";

export interface DeploymentPolicy {
  maxTxCount: number;
  maxGas: bigint;
  maxFundingWei: bigint;
  maxTransactionValueWei: bigint;
}

export function policyFor(
  chain: ChainDefinition,
  overrides: Partial<DeploymentPolicy> = {},
): DeploymentPolicy {
  const meta = chain.deployment;
  return {
    maxTxCount: overrides.maxTxCount ?? meta?.maxTransactionCount ?? 12,
    maxGas: overrides.maxGas ?? BigInt(meta?.maxGasBudget ?? 15_000_000),
    maxFundingWei: overrides.maxFundingWei ?? BigInt(meta?.maxFundingWei ?? "50000000000000000"),
    maxTransactionValueWei:
      overrides.maxTransactionValueWei ?? BigInt(meta?.maxTransactionValueWei ?? "0"),
  };
}

export function assertPreflightPolicy(input: {
  policy: DeploymentPolicy;
  transactionCount: number;
  estimatedGas: bigint;
  values: readonly bigint[];
}): void {
  if (input.transactionCount > input.policy.maxTxCount) {
    throw new DeploymentEngineError(
      "POLICY_LIMIT_EXCEEDED",
      `transaction count ${input.transactionCount} exceeds ${input.policy.maxTxCount}`,
    );
  }
  if (input.estimatedGas > input.policy.maxGas) {
    throw new DeploymentEngineError(
      "POLICY_LIMIT_EXCEEDED",
      `estimated gas ${input.estimatedGas.toString()} exceeds ${input.policy.maxGas.toString()}`,
    );
  }
  for (const value of input.values) {
    if (value > input.policy.maxTransactionValueWei) {
      throw new DeploymentEngineError(
        "POLICY_LIMIT_EXCEEDED",
        "deployment transaction value exceeds the testnet policy",
      );
    }
  }
}
