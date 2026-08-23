import type { CompatibilityCategory } from "@chainport/shared";

import { evaluation } from "../evaluation.js";
import type { CompatibilityRule } from "../types.js";

function categoryFor(requirement: { category: string; key: string }): CompatibilityCategory {
  switch (requirement.category) {
    case "TOKEN":
      return "TOKENS";
    case "ORACLE":
      return "ORACLES";
    case "PROTOCOL":
      return "PROTOCOLS";
    case "CROSS_CHAIN":
      return "CROSS_CHAIN";
    case "RPC":
      return "RPC";
    case "FRONTEND":
      return "FRONTEND";
    case "NETWORK":
      return "CONFIGURATION";
    default:
      return "CONFIGURATION";
  }
}

export const unmappedRequirementRule: CompatibilityRule = {
  id: "unmapped-requirement",
  version: "1",
  supports() {
    return true;
  },
  evaluate(requirement, context) {
    return evaluation(this, {
      status: "UNKNOWN",
      category: categoryFor(requirement),
      requirementId: requirement.id,
      title: `${requirement.key} could not be evaluated on ${context.targetChainName}`,
      summary: `Requirement ${requirement.key} was recorded, but this ruleset has no dedicated comparison for it on ${context.targetChainName}. Verify whether it is a target-network dependency before treating it as a migration task.`,
      technicalReason: "Unmapped requirements stay UNKNOWN instead of being guessed.",
      sourceValue: requirement.detectedValue,
      targetValue: null,
      confidence: "LOW",
      remediationType: "UNKNOWN",
      registryEvidence: {
        requirementKey: requirement.key,
        requirementType: requirement.requirementType,
        nextAction: "REVIEW_DYNAMIC_CONFIGURATION",
      },
    });
  },
};
