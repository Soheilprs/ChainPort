import type { ChainCapabilities, InfrastructureEntry, PrecompileId } from "./types.js";

export const PARIS_PRECOMPILES = [
  "ecrecover",
  "sha256",
  "ripemd160",
  "identity",
  "modexp",
  "ecadd",
  "ecmul",
  "ecpairing",
  "blake2f",
] as const satisfies readonly PrecompileId[];

export const CANCUN_PRECOMPILES = [
  ...PARIS_PRECOMPILES,
  "point_evaluation",
] as const satisfies readonly PrecompileId[];

export const ethereumMainnetCapabilities: ChainCapabilities = {
  evmVersion: "prague",
  eip1559: true,
  push0: true,
  transientStorage: true,
  mcopy: true,
  blobTransactions: true,
  create2: true,
  precompiles: CANCUN_PRECOMPILES,
};

export const ethereumTestnetCapabilities: ChainCapabilities = {
  ...ethereumMainnetCapabilities,
};

export const opStackCapabilities: ChainCapabilities = {
  evmVersion: "cancun",
  eip1559: true,
  push0: true,
  transientStorage: true,
  mcopy: true,
  blobTransactions: false,
  create2: true,
  precompiles: CANCUN_PRECOMPILES,
};

export const arbitrumCapabilities: ChainCapabilities = {
  evmVersion: "cancun",
  eip1559: true,
  push0: true,
  transientStorage: true,
  mcopy: true,
  blobTransactions: false,
  create2: true,
  precompiles: CANCUN_PRECOMPILES,
};

export function infra(
  id: string,
  name: string,
  status: InfrastructureEntry["status"],
  notes?: string,
): InfrastructureEntry {
  return notes === undefined ? { id, name, status } : { id, name, status, notes };
}

export const matureL1Infrastructure = {
  oracles: [infra("chainlink", "Chainlink", "available"), infra("pyth", "Pyth", "available")],
  bridges: [infra("canonical", "Canonical / native bridges", "available")],
  indexers: [
    infra("the-graph", "The Graph", "available"),
    infra("alchemy", "Alchemy", "available"),
  ],
  verifiers: [
    infra("etherscan", "Etherscan", "available"),
    infra("sourcify", "Sourcify", "available"),
  ],
} as const;

export const matureL2Infrastructure = {
  oracles: [infra("chainlink", "Chainlink", "available"), infra("pyth", "Pyth", "available")],
  bridges: [infra("canonical", "Canonical L1 bridge", "available")],
  indexers: [infra("the-graph", "The Graph", "available")],
  verifiers: [
    infra("etherscan-family", "Etherscan-family explorer", "available"),
    infra("sourcify", "Sourcify", "partial"),
  ],
} as const;

export const emergingL2Infrastructure = {
  oracles: [
    infra("chainlink", "Chainlink", "unknown", "Confirm feed availability before migration."),
    infra("pyth", "Pyth", "unknown"),
  ],
  bridges: [infra("canonical", "Canonical L1 bridge", "partial")],
  indexers: [infra("the-graph", "The Graph", "unknown")],
  verifiers: [
    infra("blockscout", "Blockscout", "available"),
    infra("sourcify", "Sourcify", "unknown"),
  ],
} as const;
