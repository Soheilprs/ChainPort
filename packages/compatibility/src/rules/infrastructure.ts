import { lookupProtocol } from "@chainport/chain-registry";
import { checksumAddress } from "@chainport/evm";

import { findingConfidence } from "../confidence.js";
import { evaluation } from "../evaluation.js";
import { looksLikeAddress } from "../paths.js";
import type { CompatibilityRule } from "../types.js";

const INFRA_KEYS = new Set(["PERMIT2", "SAFE"]);

function sameAddress(left: string, right: string): boolean {
  try {
    return checksumAddress(left).toLowerCase() === checksumAddress(right).toLowerCase();
  } catch {
    return left.toLowerCase() === right.toLowerCase();
  }
}

export const infrastructureContractRule: CompatibilityRule = {
  id: "infrastructure-contract",
  version: "1",
  supports(requirement) {
    return INFRA_KEYS.has(requirement.key);
  },
  evaluate(requirement, context) {
    const capability = lookupProtocol(context.snapshot, requirement.key);
    const availability = capability?.availability ?? "UNKNOWN";
    const provenance = capability?.provenance ?? "UNKNOWN";
    const targetAddress = capability?.address ?? null;
    const hardcoded = looksLikeAddress(requirement.detectedValue);
    const mandatory = requirement.confidence === "DETECTED";
    const registryEvidence = {
      id: requirement.key,
      availability,
      provenance,
      targetAddress,
    };

    if (availability === "UNAVAILABLE") {
      return evaluation(this, {
        status: mandatory ? "BLOCKER" : "WARNING",
        category: "CONTRACTS",
        requirementId: requirement.id,
        title: `${requirement.key} is unavailable on the target chain`,
        summary: `The project requires ${requirement.key}, and the ${context.targetChainName} registry marks it unavailable.`,
        technicalReason:
          "A package import alone is not treated as a runtime blocker unless confidence is DETECTED.",
        sourceValue: requirement.detectedValue,
        targetValue: "UNAVAILABLE",
        confidence: findingConfidence(requirement.confidence, provenance),
        remediationType: mandatory ? "INFRASTRUCTURE_REQUIRED" : "MANUAL_REVIEW",
        registryEvidence,
      });
    }

    if (availability !== "AVAILABLE") {
      return evaluation(this, {
        status: "UNKNOWN",
        category: "CONTRACTS",
        requirementId: requirement.id,
        title: `${requirement.key} target deployment is unverified`,
        summary: `The project requires ${requirement.key}, but ChainPort has no verified ${context.targetChainName} deployment.`,
        technicalReason: "UNKNOWN is not a blocker.",
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
        category: "CONTRACTS",
        requirementId: requirement.id,
        title: `${requirement.key} address must be remapped`,
        summary: `${requirement.key} exists on ${context.targetChainName}; the hardcoded source address differs.`,
        technicalReason:
          "Infrastructure is available. Source-chain address requires ADDRESS_MAPPING.",
        sourceValue: requirement.detectedValue,
        targetValue: targetAddress,
        confidence: findingConfidence(requirement.confidence, provenance),
        remediationType: "ADDRESS_MAPPING",
        registryEvidence,
      });
    }

    return evaluation(this, {
      status: "PASS",
      category: "CONTRACTS",
      requirementId: requirement.id,
      title: `${requirement.key} is available on the target chain`,
      summary:
        hardcoded && targetAddress !== null && sameAddress(requirement.detectedValue, targetAddress)
          ? `Hardcoded ${requirement.key} address already matches the ${context.targetChainName} deployment.`
          : `${requirement.key} is recorded as available on ${context.targetChainName}.`,
      technicalReason: "Target infrastructure snapshot lists this contract as available.",
      sourceValue: requirement.detectedValue,
      targetValue: targetAddress ?? "AVAILABLE",
      confidence: findingConfidence(requirement.confidence, provenance),
      remediationType: "NONE",
      registryEvidence,
    });
  },
};
