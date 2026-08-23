import { findingConfidence } from "../confidence.js";
import { evaluation } from "../evaluation.js";
import type { CompatibilityRule } from "../types.js";

export const hardcodedAddressRule: CompatibilityRule = {
  id: "hardcoded-address",
  version: "2",
  supports(requirement) {
    return (
      requirement.key === "UNKNOWN_EVM_ADDRESS" ||
      requirement.requirementType === "UNKNOWN_EVM_ADDRESS"
    );
  },
  evaluate(requirement, context) {
    const address = requirement.detectedValue;
    return evaluation(this, {
      status: "UNKNOWN",
      category: "CONTRACTS",
      requirementId: requirement.id,
      title: `Contract at ${address.slice(0, 10)}… could not be semantically identified`,
      summary: `A hardcoded address is not in the known-token or infrastructure catalog, so ChainPort cannot map it onto ${context.targetChainName}. Identify the contract and confirm whether a ${context.targetChainName} deployment exists.`,
      technicalReason:
        "No equivalent address is fabricated for unclassified contracts. UNKNOWN is not treated as unavailable.",
      sourceValue: address,
      targetValue: null,
      confidence: findingConfidence(requirement.confidence, "UNKNOWN"),
      remediationType: "UNKNOWN",
      registryEvidence: {
        targetChainKey: context.targetChainKey,
        nextAction: "IDENTIFY_EXTERNAL_ADDRESS",
      },
    });
  },
};
