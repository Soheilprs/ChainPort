import { findingConfidence } from "../confidence.js";
import { evaluation } from "../evaluation.js";
import type { CompatibilityRule } from "../types.js";

export const projectDeploymentRule: CompatibilityRule = {
  id: "project-deployment",
  version: "1",
  supports(requirement) {
    return requirement.key === "PROJECT_DEPLOYMENT";
  },
  evaluate(requirement, context) {
    const name = requirement.normalizedValue;
    return evaluation(this, {
      status: "WARNING",
      category: "CONFIGURATION",
      requirementId: requirement.id,
      title: `${name} must be redeployed on ${context.targetChainName}`,
      summary: `Hardcoded ${name} addresses are this repository's own source-chain deployments. Redeploy ${name} on ${context.targetChainName} and replace every stored address.`,
      technicalReason:
        "These addresses were classified from repository identifiers and contract names. They are not unknown external protocols, and they will not exist at the same address on the target.",
      sourceValue: requirement.detectedValue,
      targetValue: null,
      confidence: findingConfidence(requirement.confidence, "DECLARED"),
      remediationType: "CONFIG_CHANGE",
      registryEvidence: {
        contractName: name,
        nextAction: "VERIFY_PROTOCOL_DEPLOYMENT",
      },
    });
  },
};
