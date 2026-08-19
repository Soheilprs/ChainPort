import type { CapabilityAvailability, CapabilityProvenance } from "@chainport/shared";

export const REGISTRY_VERSION = "1";

export interface TokenCapability {
  symbol: "USDC" | "USDT" | "WETH";
  availability: CapabilityAvailability;
  provenance: CapabilityProvenance;
  address: string | null;
}

export interface RpcMethodCapability {
  method: string;
  availability: CapabilityAvailability;
  provenance: CapabilityProvenance;
}

export interface ProtocolCapability {
  id: string;
  availability: CapabilityAvailability;
  provenance: CapabilityProvenance;
  address: string | null;
}

export interface OracleFeedCapability {
  id: string;
  pair: string;
  availability: CapabilityAvailability;
  provenance: CapabilityProvenance;
  address: string | null;
}

export interface TargetCapabilitySnapshot {
  registryVersion: string;
  chainKey: string;
  chainId: number;
  family: string;
  evmVersion: string;
  rpcUrls: readonly string[];
  tokens: readonly TokenCapability[];
  rpcMethods: readonly RpcMethodCapability[];
  protocols: readonly ProtocolCapability[];
  feeds: readonly OracleFeedCapability[];
}

export interface HashedTargetSnapshot {
  snapshot: TargetCapabilitySnapshot;
  canonicalJson: string;
  hash: string;
}
