import type {
  ChainFamily,
  ChainRole,
  EvmVersion,
  InfrastructureStatus,
  NetworkKind,
} from "@chainport/shared";

export const PRECOMPILE_IDS = [
  "ecrecover",
  "sha256",
  "ripemd160",
  "identity",
  "modexp",
  "ecadd",
  "ecmul",
  "ecpairing",
  "blake2f",
  "point_evaluation",
] as const;
export type PrecompileId = (typeof PRECOMPILE_IDS)[number];

export interface NativeCurrency {
  name: string;
  symbol: string;
  decimals: number;
}

export interface ChainExplorer {
  name: string;
  url: string;
}

export interface InfrastructureEntry {
  id: string;
  name: string;
  status: InfrastructureStatus;
  notes?: string;
}

export interface ChainCapabilities {
  evmVersion: EvmVersion;
  eip1559: boolean;
  push0: boolean;
  transientStorage: boolean;
  mcopy: boolean;
  blobTransactions: boolean;
  create2: boolean;
  precompiles: readonly PrecompileId[];
}

export interface ChainInfrastructure {
  oracles: readonly InfrastructureEntry[];
  bridges: readonly InfrastructureEntry[];
  indexers: readonly InfrastructureEntry[];
  verifiers: readonly InfrastructureEntry[];
}

export interface ChainDefinition {
  key: string;
  name: string;
  shortName: string;
  chainId: number;
  networkKind: NetworkKind;
  family: ChainFamily;
  roles: readonly ChainRole[];
  nativeCurrency: NativeCurrency;
  rpcUrls: readonly string[];
  explorers: readonly ChainExplorer[];
  parentChainKey?: string;
  testnetOf?: string;
  capabilities: ChainCapabilities;
  infrastructure: ChainInfrastructure;
}

export interface ChainSummary {
  key: string;
  name: string;
  shortName: string;
  chainId: number;
  networkKind: NetworkKind;
  family: ChainFamily;
  roles: readonly ChainRole[];
}

export function toChainSummary(chain: ChainDefinition): ChainSummary {
  return {
    key: chain.key,
    name: chain.name,
    shortName: chain.shortName,
    chainId: chain.chainId,
    networkKind: chain.networkKind,
    family: chain.family,
    roles: chain.roles,
  };
}
