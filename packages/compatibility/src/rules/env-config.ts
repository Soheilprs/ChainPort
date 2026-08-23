import { lookupToken } from "@chainport/chain-registry";

import { findingConfidence } from "../confidence.js";
import { evaluation } from "../evaluation.js";
import type { CompatibilityRule } from "../types.js";

const NETWORK_ENV = /(^|_)(RPC(_URL)?|CHAIN_ID|EXPLORER(_URL)?|NETWORK(_NAME)?|CHAINID)(_|$)/i;
const TOKEN_ENV = /USDC|USDT|WETH|(^|_)LINK(_|$)|CHAINLINK_TOKEN/i;
const ORACLE_ENV = /CHAINLINK|PRICE_FEED|AGGREGATOR|FUNCTIONS_ROUTER/i;

function tokenSymbol(key: string): "USDC" | "USDT" | "WETH" | "LINK" | undefined {
  if (/USDC/i.test(key)) return "USDC";
  if (/USDT/i.test(key)) return "USDT";
  if (/WETH/i.test(key)) return "WETH";
  if (/(^|_)LINK(_|$)|CHAINLINK_TOKEN/i.test(key)) return "LINK";
  return undefined;
}

export const envConfigRule: CompatibilityRule = {
  id: "env-config",
  version: "2",
  supports(requirement) {
    return (
      requirement.key === "ENV_KEY" &&
      (NETWORK_ENV.test(requirement.detectedValue) ||
        TOKEN_ENV.test(requirement.detectedValue) ||
        ORACLE_ENV.test(requirement.detectedValue))
    );
  },
  evaluate(requirement, context) {
    const key = requirement.detectedValue;
    const symbol = tokenSymbol(key);
    if (symbol !== undefined) {
      const capability = lookupToken(context.snapshot, symbol);
      return evaluation(this, {
        status: "WARNING",
        category: "TOKENS",
        requirementId: requirement.id,
        title: `${symbol} environment address must be remapped for ${context.targetChainName}`,
        summary: `Template key ${key} is a source-network ${symbol} setting. Use the verified ${context.targetChainName} ${symbol} deployment before launch.`,
        technicalReason:
          "Token environment keys are configuration, not unknown capabilities. The value is replaced after confirming the target deployment.",
        sourceValue: requirement.normalizedValue,
        targetValue: capability?.address ?? capability?.availability ?? null,
        confidence: findingConfidence(requirement.confidence, capability?.provenance ?? "UNKNOWN"),
        remediationType: "ADDRESS_MAPPING",
        registryEvidence: {
          envKey: key,
          symbol,
          nextAction: "VERIFY_TARGET_TOKEN_ADDRESS",
          availability: capability?.availability ?? "UNKNOWN",
          targetAddress: capability?.address ?? null,
        },
      });
    }

    if (ORACLE_ENV.test(key) && !NETWORK_ENV.test(key)) {
      return evaluation(this, {
        status: "WARNING",
        category: "ORACLES",
        requirementId: requirement.id,
        title: `Oracle environment configuration must be updated for ${context.targetChainName}`,
        summary: `Template key ${key} points at source-network oracle infrastructure and must be replaced with a verified ${context.targetChainName} feed or Functions router.`,
        technicalReason:
          "Generic Chainlink availability does not imply every feed or Functions parameter is correct on the target.",
        sourceValue: requirement.normalizedValue,
        targetValue: null,
        confidence: findingConfidence(requirement.confidence, "DECLARED"),
        remediationType: "MANUAL_REVIEW",
        registryEvidence: {
          envKey: key,
          nextAction: "VERIFY_ORACLE_FEED",
        },
      });
    }

    return evaluation(this, {
      status: "WARNING",
      category: "CONFIGURATION",
      requirementId: requirement.id,
      title: "Environment network configuration must be updated",
      summary: `Template key ${key} is source-network configuration and must be replaced for ${context.targetChainName}.`,
      technicalReason:
        "Environment templates record chain-specific RPC, chain ID, or explorer settings. This is a configuration change, not a missing chain capability.",
      sourceValue: requirement.normalizedValue,
      targetValue:
        /RPC/i.test(key) && context.snapshot.rpcUrls[0]
          ? context.snapshot.rpcUrls[0]
          : String(context.targetChainId),
      confidence: findingConfidence(requirement.confidence, "VERIFIED"),
      remediationType: "CONFIG_CHANGE",
      registryEvidence: {
        envKey: key,
        nextAction: "VERIFY_RPC_METHOD",
        targetChainId: String(context.targetChainId),
        targetRpcUrls: [...context.snapshot.rpcUrls],
      },
    });
  },
};
