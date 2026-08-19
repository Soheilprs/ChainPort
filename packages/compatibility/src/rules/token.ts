import { lookupToken } from "@chainport/chain-registry";
import { checksumAddress } from "@chainport/evm";

import { findingConfidence } from "../confidence.js";
import { evaluation } from "../evaluation.js";
import { looksLikeAddress } from "../paths.js";
import type { CompatibilityRule } from "../types.js";

const TOKEN_KEYS = new Set(["USDC", "USDT", "WETH"]);

function sameAddress(left: string, right: string): boolean {
  try {
    return checksumAddress(left).toLowerCase() === checksumAddress(right).toLowerCase();
  } catch {
    return left.toLowerCase() === right.toLowerCase();
  }
}

export const tokenAvailabilityRule: CompatibilityRule = {
  id: "token-availability",
  version: "1",
  supports(requirement) {
    return requirement.category === "TOKEN" && TOKEN_KEYS.has(requirement.key);
  },
  evaluate(requirement, context) {
    const capability = lookupToken(context.snapshot, requirement.key);
    const availability = capability?.availability ?? "UNKNOWN";
    const provenance = capability?.provenance ?? "UNKNOWN";
    const targetAddress = capability?.address ?? null;
    const hardcoded = looksLikeAddress(requirement.detectedValue);
    const registryEvidence = {
      symbol: requirement.key,
      availability,
      provenance,
      targetAddress,
    };

    if (availability === "UNAVAILABLE") {
      const blocker = requirement.confidence === "DETECTED";
      return evaluation(this, {
        status: blocker ? "BLOCKER" : "WARNING",
        category: "TOKENS",
        requirementId: requirement.id,
        title: `${requirement.key} is unavailable on the target chain`,
        summary: `The project requires ${requirement.key}, and the ${context.targetChainName} registry marks it unavailable.`,
        technicalReason:
          "Token availability is an explicit registry fact, not inferred from EVM compatibility.",
        sourceValue: requirement.detectedValue,
        targetValue: "UNAVAILABLE",
        confidence: findingConfidence(requirement.confidence, provenance),
        remediationType: blocker ? "INFRASTRUCTURE_REQUIRED" : "MANUAL_REVIEW",
        registryEvidence,
      });
    }

    if (availability !== "AVAILABLE") {
      return evaluation(this, {
        status: "UNKNOWN",
        category: "TOKENS",
        requirementId: requirement.id,
        title: `${requirement.key} target availability is unverified`,
        summary: `The project requires ${requirement.key}, but ChainPort has no verified ${context.targetChainName} deployment.`,
        technicalReason: "UNKNOWN is not treated as unavailable.",
        sourceValue: requirement.detectedValue,
        targetValue: "UNKNOWN",
        confidence: "LOW",
        remediationType: "UNKNOWN",
        registryEvidence,
      });
    }

    if (
      hardcoded &&
      targetAddress !== null &&
      !sameAddress(requirement.detectedValue, targetAddress)
    ) {
      return evaluation(this, {
        status: "WARNING",
        category: "TOKENS",
        requirementId: requirement.id,
        title: `${requirement.key} must be remapped to the target deployment`,
        summary: `${requirement.key} exists on ${context.targetChainName}, but the application hardcodes a source-chain address.`,
        technicalReason:
          "The dependency is available. The source-chain address is not valid on the target and requires ADDRESS_MAPPING.",
        sourceValue: requirement.detectedValue,
        targetValue: targetAddress,
        confidence: findingConfidence(requirement.confidence, provenance),
        remediationType: "ADDRESS_MAPPING",
        registryEvidence,
      });
    }

    if (hardcoded && targetAddress === null) {
      return evaluation(this, {
        status: "WARNING",
        category: "TOKENS",
        requirementId: requirement.id,
        title: `${requirement.key} is available but has no catalogued target address`,
        summary: `${context.targetChainName} has ${requirement.key}, but ChainPort does not have a verified address mapping.`,
        technicalReason: "No equivalent address is fabricated.",
        sourceValue: requirement.detectedValue,
        targetValue: "AVAILABLE",
        confidence: findingConfidence(requirement.confidence, provenance),
        remediationType: "MANUAL_REVIEW",
        registryEvidence,
      });
    }

    return evaluation(this, {
      status: "PASS",
      category: "TOKENS",
      requirementId: requirement.id,
      title: `${requirement.key} is available on the target chain`,
      summary:
        hardcoded && targetAddress !== null && sameAddress(requirement.detectedValue, targetAddress)
          ? `Hardcoded ${requirement.key} address already matches the ${context.targetChainName} deployment.`
          : `${requirement.key} is present on ${context.targetChainName}.`,
      technicalReason:
        "Target token capability is available and no source-address remap is required.",
      sourceValue: requirement.detectedValue,
      targetValue: targetAddress,
      confidence: findingConfidence(requirement.confidence, provenance),
      remediationType: "NONE",
      registryEvidence,
    });
  },
};
