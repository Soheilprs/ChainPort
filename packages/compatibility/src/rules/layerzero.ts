import { lookupProtocol } from "@chainport/chain-registry";

import { findingConfidence } from "../confidence.js";
import { evaluation } from "../evaluation.js";
import type { CompatibilityRule } from "../types.js";

export const layerZeroRule: CompatibilityRule = {
  id: "layerzero",
  version: "1",
  supports(requirement) {
    return requirement.key === "LAYERZERO";
  },
  evaluate(requirement, context) {
    const capability = lookupProtocol(context.snapshot, "LAYERZERO");
    const availability = capability?.availability ?? "UNKNOWN";
    const provenance = capability?.provenance ?? "UNKNOWN";
    const registryEvidence = { id: "LAYERZERO", availability, provenance };
    const mandatory = requirement.confidence === "DETECTED";

    if (availability === "AVAILABLE") {
      return evaluation(this, {
        status: "PASS",
        category: "CROSS_CHAIN",
        requirementId: requirement.id,
        title: "LayerZero is available on the target chain",
        summary: `${context.targetChainName} registry lists a LayerZero endpoint as available.`,
        technicalReason: "Another bridge is not treated as a substitute.",
        sourceValue: "LAYERZERO",
        targetValue: capability?.address ?? "AVAILABLE",
        confidence: findingConfidence(requirement.confidence, provenance),
        remediationType: "NONE",
        registryEvidence,
      });
    }

    if (availability === "UNAVAILABLE") {
      return evaluation(this, {
        status: mandatory ? "BLOCKER" : "WARNING",
        category: "CROSS_CHAIN",
        requirementId: requirement.id,
        title: "LayerZero is unsupported on the target chain",
        summary: `The project requires LayerZero, and ${context.targetChainName} explicitly does not support it.`,
        technicalReason: "Cross-chain providers are not interchangeable.",
        sourceValue: "LAYERZERO",
        targetValue: "UNAVAILABLE",
        confidence: findingConfidence(requirement.confidence, provenance),
        remediationType: mandatory ? "INFRASTRUCTURE_REQUIRED" : "MANUAL_REVIEW",
        registryEvidence,
      });
    }

    return evaluation(this, {
      status: "UNKNOWN",
      category: "CROSS_CHAIN",
      requirementId: requirement.id,
      title: "LayerZero target support is unverified",
      summary: `The project requires LayerZero, but ChainPort has no verified ${context.targetChainName} endpoint data.`,
      technicalReason: "UNKNOWN is not a blocker, and no other bridge is assumed as a replacement.",
      sourceValue: "LAYERZERO",
      targetValue: "UNKNOWN",
      confidence: "LOW",
      remediationType: "UNKNOWN",
      registryEvidence,
    });
  },
};
