import { STANDARD_JSON_RPC_METHODS } from "@chainport/chain-registry";

import type { CompatibilityRequirement } from "./types.js";

const SKIP_KEYS = new Set([
  "SOLIDITY_PRAGMA",
  "SOLIDITY_IMPORT",
  "FOUNDRY",
  "HARDHAT",
  "NEXTJS",
  "VIEM",
  "WAGMI",
  "ETHERS",
]);

const SKIP_ENV_KEYS =
  /PRIVATE_KEY|API_KEY|SECRET|PASSWORD|TLS|CONTAINER|MNEMONIC|DECIMALS|DATABASE|JWT|SENTRY|EMAIL|NEXTAUTH/i;

const NON_SOURCE_PATH =
  /(?:^|\/)(?:test|tests|mocks|fixtures|tasks)(?:\/|$)|\.test\.|\.spec\.|\.t\.sol$|\.openzeppelin(?:\/|$)|(?:^|\/)broadcast(?:\/|$)|(?:^|\/)deployments(?:\/|$)/i;

const STANDARD_RPC = new Set(STANDARD_JSON_RPC_METHODS);

export function shouldSkipRequirement(requirement: CompatibilityRequirement): boolean {
  if (requirement.category === "FRAMEWORK") {
    return true;
  }
  if (SKIP_KEYS.has(requirement.key)) {
    return true;
  }
  if (requirement.key === "ENV_KEY" && SKIP_ENV_KEYS.test(requirement.detectedValue)) {
    return true;
  }
  if (
    requirement.key === "UNKNOWN_EVM_ADDRESS" &&
    requirement.evidenceFilePaths.every(
      (path) => path.includes(".env") || path.endsWith(".md") || NON_SOURCE_PATH.test(path),
    )
  ) {
    return true;
  }
  if (requirement.key === "RPC_METHOD" && STANDARD_RPC.has(requirement.normalizedValue)) {
    return true;
  }
  return false;
}
