import type { RequirementCategory } from "@chainport/shared";

import { classifyKnownAddress } from "./known-addresses.js";

export type AddressSemantic =
  | {
      kind: "named";
      key: string;
      category: RequirementCategory;
      requirementType: "NAMED_ADDRESS" | "PROTOCOL";
    }
  | { kind: "project"; name: string }
  | { kind: "unknown" };

const NETWORK_WORDS = new Set([
  "sepolia",
  "goerli",
  "holesky",
  "hoodi",
  "mainnet",
  "ethereum",
  "optimism",
  "base",
  "arbitrum",
  "polygon",
  "avalanche",
  "linea",
  "scroll",
  "unichain",
  "bsc",
  "fantom",
  "celo",
  "blast",
  "zora",
  "monad",
  "soneium",
  "ink",
  "fuji",
  "mumbai",
  "goerli",
  "testnet",
  "predeployed",
]);

function tokenize(name: string): string[] {
  return name
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll(/[_-]+/g, " ")
    .split(/\s+/)
    .map((token) => token.toLowerCase())
    .filter((token) => token.length > 0);
}

function compact(name: string): string {
  return tokenize(name)
    .filter((token) => !NETWORK_WORDS.has(token) && token !== "address" && token !== "addresses")
    .join("");
}

function compactBlob(names: readonly string[]): string {
  return names.map(compact).join(" ");
}

function matchContract(label: string, contractNames: readonly string[]): string | undefined {
  const needle = label.toLowerCase();
  if (needle.length < 4) {
    return undefined;
  }
  const ranked = [...contractNames].sort((left, right) => right.length - left.length);
  for (const name of ranked) {
    const haystack = name.toLowerCase();
    if (haystack.length < 5 && haystack !== needle) {
      continue;
    }
    if (
      haystack === needle ||
      haystack === `${needle}s` ||
      needle === `${haystack}s` ||
      (haystack.length >= 6 && needle.includes(haystack))
    ) {
      return name;
    }
  }
  return undefined;
}

function projectNameFromIdentifier(name: string): string | undefined {
  const stripped = name
    .replace(
      /^(sepolia|goerli|holesky|mainnet|ethereum|optimism|base|arbitrum|polygon|pre_?deployed)_?/i,
      "",
    )
    .replace(/(Addresses|Address|Addr)$/i, "")
    .replace(/V\d+(?:_\d+)*$/i, "")
    .replace(/_+$/g, "");
  if (stripped.length < 4) {
    return undefined;
  }
  if (NETWORK_WORDS.has(stripped.toLowerCase())) {
    return undefined;
  }
  if (stripped === name && !/Address(es)?$/i.test(name) && stripped.length < 8) {
    return undefined;
  }
  if (stripped.length >= 6) {
    return stripped;
  }
  return undefined;
}

export function classifyAddressContext(input: {
  address: string;
  names: readonly string[];
  contractNames: readonly string[];
}): AddressSemantic {
  const known = classifyKnownAddress(input.address);
  if (known !== undefined) {
    return {
      kind: "named",
      key: known.key,
      category: known.category === "TOKEN" ? "TOKEN" : "PROTOCOL",
      requirementType: "NAMED_ADDRESS",
    };
  }

  const tokens = new Set(input.names.flatMap(tokenize));
  const blob = compactBlob(input.names);
  if (tokens.has("usdc")) {
    return { kind: "named", key: "USDC", category: "TOKEN", requirementType: "NAMED_ADDRESS" };
  }
  if (tokens.has("usdt")) {
    return { kind: "named", key: "USDT", category: "TOKEN", requirementType: "NAMED_ADDRESS" };
  }
  if (tokens.has("weth") || tokens.has("weth9") || blob.includes("weth9")) {
    return { kind: "named", key: "WETH", category: "TOKEN", requirementType: "NAMED_ADDRESS" };
  }
  if (tokens.has("link")) {
    return { kind: "named", key: "LINK", category: "TOKEN", requirementType: "NAMED_ADDRESS" };
  }
  if (tokens.has("permit2")) {
    return {
      kind: "named",
      key: "PERMIT2",
      category: "PROTOCOL",
      requirementType: "NAMED_ADDRESS",
    };
  }
  if (
    tokens.has("layerzero") ||
    tokens.has("layerzeroendpoints") ||
    blob.includes("layerzeroendpoint") ||
    (tokens.has("lz") && tokens.has("endpoint"))
  ) {
    return {
      kind: "named",
      key: "LAYERZERO",
      category: "CROSS_CHAIN",
      requirementType: "PROTOCOL",
    };
  }
  if (
    tokens.has("v4") &&
    (tokens.has("poolmanager") ||
      tokens.has("position") ||
      tokens.has("uniswap") ||
      blob.includes("poolmanager") ||
      blob.includes("positionmanager"))
  ) {
    return { kind: "named", key: "UNISWAP_V4", category: "PROTOCOL", requirementType: "PROTOCOL" };
  }
  if (
    tokens.has("v3") &&
    (tokens.has("factory") ||
      tokens.has("router") ||
      tokens.has("nft") ||
      tokens.has("position") ||
      tokens.has("nfp") ||
      tokens.has("uniswap") ||
      blob.includes("positionmanager"))
  ) {
    return { kind: "named", key: "UNISWAP_V3", category: "PROTOCOL", requirementType: "PROTOCOL" };
  }
  if (
    tokens.has("v2") &&
    (tokens.has("factory") || tokens.has("router") || tokens.has("pair") || tokens.has("uniswap"))
  ) {
    return { kind: "named", key: "UNISWAP_V2", category: "PROTOCOL", requirementType: "PROTOCOL" };
  }
  if (
    tokens.has("functions") &&
    (tokens.has("client") || tokens.has("router") || tokens.has("chainlink"))
  ) {
    return {
      kind: "named",
      key: "CHAINLINK_FUNCTIONS",
      category: "ORACLE",
      requirementType: "PROTOCOL",
    };
  }
  if (
    tokens.has("chainlink") ||
    tokens.has("aggregator") ||
    tokens.has("aggregatorv3") ||
    (tokens.has("price") && tokens.has("feed")) ||
    (tokens.has("api") && tokens.has("oracle"))
  ) {
    return { kind: "named", key: "CHAINLINK", category: "ORACLE", requirementType: "PROTOCOL" };
  }
  if ((tokens.has("gnosis") && tokens.has("safe")) || tokens.has("safeproxy")) {
    return { kind: "named", key: "SAFE", category: "PROTOCOL", requirementType: "NAMED_ADDRESS" };
  }

  for (const name of input.names) {
    const matched = matchContract(compact(name), input.contractNames);
    if (matched !== undefined) {
      return { kind: "project", name: matched };
    }
  }

  for (const name of input.names) {
    const project = projectNameFromIdentifier(name);
    if (project !== undefined) {
      const matched = matchContract(compact(project), input.contractNames);
      return { kind: "project", name: matched ?? project };
    }
  }

  return { kind: "unknown" };
}
