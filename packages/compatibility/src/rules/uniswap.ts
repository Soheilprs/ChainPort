import { lookupProtocol } from "@chainport/chain-registry";

import { findingConfidence } from "../confidence.js";
import { evaluation } from "../evaluation.js";
import type { CompatibilityRule } from "../types.js";

const UNISWAP_KEYS = new Set(["UNISWAP_V2", "UNISWAP_V3"]);

export const uniswapRule: CompatibilityRule = {
  id: "uniswap",
  version: "1",
  supports(requirement) {
    return UNISWAP_KEYS.has(requirement.key);
  },
  evaluate(requirement, context) {
    const required = requirement.key;
    const other = required === "UNISWAP_V3" ? "UNISWAP_V2" : "UNISWAP_V3";
    const capability = lookupProtocol(context.snapshot, required);
    const otherCapability = lookupProtocol(context.snapshot, other);
    const availability = capability?.availability ?? "UNKNOWN";
    const provenance = capability?.provenance ?? "UNKNOWN";
    const registryEvidence = {
      required,
      availability,
      provenance,
      otherVersion: other,
      otherAvailability: otherCapability?.availability ?? "UNKNOWN",
    };

    if (availability === "AVAILABLE") {
      return evaluation(this, {
        status: "PASS",
        category: "PROTOCOLS",
        requirementId: requirement.id,
        title: `${required} is available on the target chain`,
        summary: `${context.targetChainName} registry lists ${required} as available.`,
        technicalReason:
          "Required Uniswap version is present. A different version is not treated as a substitute.",
        sourceValue: required,
        targetValue: "AVAILABLE",
        confidence: findingConfidence(requirement.confidence, provenance),
        remediationType: "NONE",
        registryEvidence,
      });
    }

    if (availability === "UNAVAILABLE") {
      const blocker = requirement.confidence === "DETECTED";
      return evaluation(this, {
        status: blocker ? "BLOCKER" : "UNKNOWN",
        category: "PROTOCOLS",
        requirementId: requirement.id,
        title: `${required} is unavailable on the target chain`,
        summary:
          otherCapability?.availability === "AVAILABLE"
            ? `${required} is unavailable. ${other} exists and is not treated as a substitute.`
            : `${required} is explicitly unavailable on ${context.targetChainName}.`,
        technicalReason: "Uniswap V2 cannot replace V3. Version substitution is never assumed.",
        sourceValue: required,
        targetValue: "UNAVAILABLE",
        confidence: findingConfidence(requirement.confidence, provenance),
        remediationType: blocker ? "INFRASTRUCTURE_REQUIRED" : "UNKNOWN",
        registryEvidence,
      });
    }

    return evaluation(this, {
      status: "UNKNOWN",
      category: "PROTOCOLS",
      requirementId: requirement.id,
      title: `${required} target availability is unverified`,
      summary:
        otherCapability?.availability === "AVAILABLE"
          ? `${required} is unverified on ${context.targetChainName}. ${other} is present and is not a substitute.`
          : `ChainPort has no verified ${required} data for ${context.targetChainName}.`,
      technicalReason:
        "UNKNOWN is not converted to BLOCKER, and a different Uniswap version is not assumed sufficient.",
      sourceValue: required,
      targetValue: "UNKNOWN",
      confidence: "LOW",
      remediationType: "UNKNOWN",
      registryEvidence,
    });
  },
};
