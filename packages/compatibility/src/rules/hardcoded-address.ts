import { findingConfidence } from "../confidence.js";
import { evaluation } from "../evaluation.js";
import type { CompatibilityRule } from "../types.js";

export const hardcodedAddressRule: CompatibilityRule = {
  id: "hardcoded-address",
  version: "1",
  supports(requirement) {
    return (
      requirement.key === "UNKNOWN_EVM_ADDRESS" ||
      requirement.requirementType === "UNKNOWN_EVM_ADDRESS"
    );
  },
  evaluate(requirement, context) {
    return evaluation(this, {
      status: "UNKNOWN",
      category: "CONTRACTS",
      requirementId: requirement.id,
      title: "Unknown contract address cannot be mapped",
      summary: `A hardcoded address is not in the known-token or infrastructure catalog, so ChainPort cannot map it onto ${context.targetChainName}.`,
      technicalReason: "No equivalent address is fabricated for unclassified contracts.",
      sourceValue: requirement.detectedValue,
      targetValue: null,
      confidence: findingConfidence(requirement.confidence, "UNKNOWN"),
      remediationType: "MANUAL_REVIEW",
      registryEvidence: {
        targetChainKey: context.targetChainKey,
      },
    });
  },
};
