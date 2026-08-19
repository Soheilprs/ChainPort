import type { InfrastructureStatus } from "@chainport/shared";

import {
  feedsForChain,
  protocolsForChain,
  rpcMethodsForChain,
  tokensForChain,
} from "./compatibility-catalog.js";
import {
  REGISTRY_VERSION,
  type HashedTargetSnapshot,
  type ProtocolCapability,
  type TargetCapabilitySnapshot,
} from "./compatibility-types.js";
import { canonicalizeJson, sha256Hex } from "./canonicalize.js";
import { requireChainByKey } from "./lookup.js";
import type { ChainDefinition } from "./types.js";

function oracleProtocol(chain: ChainDefinition, id: string): ProtocolCapability {
  const entry = chain.infrastructure.oracles.find((item) => item.id === id);
  const status: InfrastructureStatus = entry?.status ?? "unknown";
  if (status === "available") {
    return {
      id: id.toUpperCase(),
      availability: "AVAILABLE",
      provenance: "DECLARED",
      address: null,
    };
  }
  if (status === "missing") {
    return {
      id: id.toUpperCase(),
      availability: "UNAVAILABLE",
      provenance: "VERIFIED",
      address: null,
    };
  }
  return { id: id.toUpperCase(), availability: "UNKNOWN", provenance: "UNKNOWN", address: null };
}

export function buildTargetCapabilitySnapshot(chain: ChainDefinition): TargetCapabilitySnapshot {
  const protocols = [...protocolsForChain(chain.key)];
  const chainlink = oracleProtocol(chain, "chainlink");
  const withoutOracle = protocols.filter((item) => item.id !== "CHAINLINK");
  return {
    registryVersion: REGISTRY_VERSION,
    chainKey: chain.key,
    chainId: chain.chainId,
    family: chain.family,
    evmVersion: chain.capabilities.evmVersion,
    rpcUrls: [...chain.rpcUrls].sort(),
    tokens: tokensForChain(chain.key),
    rpcMethods: rpcMethodsForChain(),
    protocols: [...withoutOracle, chainlink].sort((left, right) => left.id.localeCompare(right.id)),
    feeds: feedsForChain(chain.key),
  };
}

export function hashTargetSnapshot(snapshot: TargetCapabilitySnapshot): HashedTargetSnapshot {
  const canonical = {
    registryVersion: snapshot.registryVersion,
    chainKey: snapshot.chainKey,
    chainId: snapshot.chainId,
    family: snapshot.family,
    evmVersion: snapshot.evmVersion,
    rpcUrls: [...snapshot.rpcUrls].sort(),
    tokens: [...snapshot.tokens].sort((left, right) => left.symbol.localeCompare(right.symbol)),
    rpcMethods: [...snapshot.rpcMethods].sort((left, right) =>
      left.method.localeCompare(right.method),
    ),
    protocols: [...snapshot.protocols].sort((left, right) => left.id.localeCompare(right.id)),
    feeds: [...snapshot.feeds].sort((left, right) => left.id.localeCompare(right.id)),
  };
  const canonicalJson = canonicalizeJson(canonical);
  return {
    snapshot,
    canonicalJson,
    hash: sha256Hex(canonicalJson),
  };
}

export function snapshotForChainKey(chainKey: string): HashedTargetSnapshot {
  return hashTargetSnapshot(buildTargetCapabilitySnapshot(requireChainByKey(chainKey)));
}

export function lookupToken(snapshot: TargetCapabilitySnapshot, symbol: string) {
  return snapshot.tokens.find((item) => item.symbol === symbol);
}

export function lookupRpcMethod(snapshot: TargetCapabilitySnapshot, method: string) {
  return snapshot.rpcMethods.find((item) => item.method === method);
}

export function lookupProtocol(snapshot: TargetCapabilitySnapshot, id: string) {
  return snapshot.protocols.find((item) => item.id === id);
}

export function lookupFeed(snapshot: TargetCapabilitySnapshot, pairOrId: string) {
  const id = pairOrId.startsWith("CHAINLINK_PRICE_FEED:")
    ? pairOrId
    : `CHAINLINK_PRICE_FEED:${pairOrId}`;
  return snapshot.feeds.find((item) => item.id === id || item.pair === pairOrId);
}
