import { lookupFeed, lookupProtocol } from "@chainport/chain-registry";

import { findingConfidence } from "../confidence.js";
import { evaluation } from "../evaluation.js";
import { looksLikeAddress } from "../paths.js";
import type { CompatibilityEvaluation, CompatibilityRule } from "../types.js";

function chainlinkResult(
  rule: CompatibilityRule,
  requirement: Parameters<CompatibilityRule["evaluate"]>[0],
  context: Parameters<CompatibilityRule["evaluate"]>[1],
  titlePrefix: string,
  pair: string | null,
): CompatibilityEvaluation {
  const protocol = lookupProtocol(context.snapshot, "CHAINLINK");
  const feed = pair === null ? undefined : lookupFeed(context.snapshot, pair);
  const availability = feed?.availability ?? protocol?.availability ?? "UNKNOWN";
  const provenance = feed?.provenance ?? protocol?.provenance ?? "UNKNOWN";
  const targetAddress = feed?.address ?? protocol?.address ?? null;
  const hardcoded = looksLikeAddress(requirement.detectedValue);
  const registryEvidence = {
    protocol: "CHAINLINK",
    pair,
    availability,
    provenance,
    targetAddress,
    genericChainlink: protocol?.availability ?? "UNKNOWN",
    specificFeed: feed?.availability ?? null,
  };

  if (pair !== null && protocol?.availability === "AVAILABLE" && feed === undefined) {
    return evaluation(rule, {
      status: "UNKNOWN",
      category: "ORACLES",
      requirementId: requirement.id,
      title: `Chainlink ${pair} feed status is unverified`,
      summary: `Chainlink is present on ${context.targetChainName}, but this specific feed is not in the registry.`,
      technicalReason: "Generic Chainlink availability does not imply every feed exists.",
      sourceValue: requirement.detectedValue,
      targetValue: "UNKNOWN",
      confidence: "LOW",
      remediationType: "UNKNOWN",
      registryEvidence,
    });
  }

  if (availability === "UNAVAILABLE") {
    const blocker = requirement.confidence === "DETECTED";
    return evaluation(rule, {
      status: blocker ? "BLOCKER" : "WARNING",
      category: "ORACLES",
      requirementId: requirement.id,
      title: `${titlePrefix} is unavailable on the target chain`,
      summary: `The project requires ${titlePrefix}, and the ${context.targetChainName} registry marks it unavailable.`,
      technicalReason: "Oracle unavailability is an explicit registry fact.",
      sourceValue: requirement.detectedValue,
      targetValue: "UNAVAILABLE",
      confidence: findingConfidence(requirement.confidence, provenance),
      remediationType: blocker ? "INFRASTRUCTURE_REQUIRED" : "MANUAL_REVIEW",
      registryEvidence,
    });
  }

  if (availability !== "AVAILABLE") {
    return evaluation(rule, {
      status: "UNKNOWN",
      category: "ORACLES",
      requirementId: requirement.id,
      title: `${titlePrefix} target availability is unverified`,
      summary: `The project requires ${titlePrefix}, but ChainPort has no verified ${context.targetChainName} data.`,
      technicalReason: "UNKNOWN is not converted to BLOCKER.",
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
    requirement.detectedValue.toLowerCase() !== targetAddress.toLowerCase()
  ) {
    return evaluation(rule, {
      status: "WARNING",
      category: "ORACLES",
      requirementId: requirement.id,
      title: `${titlePrefix} address must be remapped`,
      summary: `${titlePrefix} exists on ${context.targetChainName}; the hardcoded source address is not the target deployment.`,
      technicalReason:
        "Oracle infrastructure is available. The source feed address requires ADDRESS_MAPPING.",
      sourceValue: requirement.detectedValue,
      targetValue: targetAddress,
      confidence: findingConfidence(requirement.confidence, provenance),
      remediationType: "ADDRESS_MAPPING",
      registryEvidence,
    });
  }

  if (hardcoded && targetAddress === null) {
    return evaluation(rule, {
      status: "WARNING",
      category: "ORACLES",
      requirementId: requirement.id,
      title: `${titlePrefix} is available; source address still needs review`,
      summary: `Chainlink is available on ${context.targetChainName}, but no verified target feed address is catalogued.`,
      technicalReason: "No equivalent address is fabricated.",
      sourceValue: requirement.detectedValue,
      targetValue: "AVAILABLE",
      confidence: findingConfidence(requirement.confidence, provenance),
      remediationType: "MANUAL_REVIEW",
      registryEvidence,
    });
  }

  return evaluation(rule, {
    status: "PASS",
    category: "ORACLES",
    requirementId: requirement.id,
    title: `${titlePrefix} is available on the target chain`,
    summary: `${titlePrefix} is recorded as available on ${context.targetChainName}.`,
    technicalReason: "Target oracle capability snapshot lists this requirement as available.",
    sourceValue: requirement.detectedValue,
    targetValue: targetAddress ?? "AVAILABLE",
    confidence: findingConfidence(requirement.confidence, provenance),
    remediationType: "NONE",
    registryEvidence,
  });
}

export const oracleAvailabilityRule: CompatibilityRule = {
  id: "oracle-availability",
  version: "1",
  supports(requirement) {
    return (
      requirement.key === "CHAINLINK" ||
      requirement.key === "CHAINLINK_FUNCTIONS" ||
      requirement.key.startsWith("CHAINLINK_PRICE_FEED:")
    );
  },
  evaluate(requirement, context) {
    if (requirement.key === "CHAINLINK_FUNCTIONS") {
      const capability = lookupProtocol(context.snapshot, "CHAINLINK_FUNCTIONS");
      const availability = capability?.availability ?? "UNKNOWN";
      const provenance = capability?.provenance ?? "UNKNOWN";
      const registryEvidence = {
        protocol: "CHAINLINK_FUNCTIONS",
        availability,
        provenance,
        targetAddress: capability?.address ?? null,
        nextAction: "VERIFY_PROTOCOL_DEPLOYMENT",
      };
      if (availability === "AVAILABLE") {
        return evaluation(this, {
          status: "PASS",
          category: "ORACLES",
          requirementId: requirement.id,
          title: "Chainlink Functions is available on the target chain",
          summary: `${context.targetChainName} lists a Chainlink Functions router. Confirm DON ID and subscription configuration after remap.`,
          technicalReason:
            "Functions availability is recorded separately from generic Chainlink price-feed availability.",
          sourceValue: requirement.detectedValue,
          targetValue: capability?.address ?? "AVAILABLE",
          confidence: findingConfidence(requirement.confidence, provenance),
          remediationType: "NONE",
          registryEvidence,
        });
      }
      if (availability === "UNAVAILABLE") {
        const blocker = requirement.confidence === "DETECTED";
        return evaluation(this, {
          status: blocker ? "BLOCKER" : "WARNING",
          category: "ORACLES",
          requirementId: requirement.id,
          title: "Chainlink Functions is unavailable on the target chain",
          summary: `The project requires Chainlink Functions, and the ${context.targetChainName} registry marks it unavailable.`,
          technicalReason: "Functions is not implied by generic Chainlink or price-feed support.",
          sourceValue: requirement.detectedValue,
          targetValue: "UNAVAILABLE",
          confidence: findingConfidence(requirement.confidence, provenance),
          remediationType: blocker ? "INFRASTRUCTURE_REQUIRED" : "MANUAL_REVIEW",
          registryEvidence,
        });
      }
      return evaluation(this, {
        status: "UNKNOWN",
        category: "ORACLES",
        requirementId: requirement.id,
        title: `Chainlink Functions deployment on ${context.targetChainName} could not be verified`,
        summary: `The project uses Chainlink Functions, but ChainPort has no verified ${context.targetChainName} Functions router.`,
        technicalReason: "UNKNOWN is not converted to BLOCKER.",
        sourceValue: requirement.detectedValue,
        targetValue: "UNKNOWN",
        confidence: "LOW",
        remediationType: "UNKNOWN",
        registryEvidence,
      });
    }
    if (requirement.key.startsWith("CHAINLINK_PRICE_FEED:")) {
      const pair = requirement.key.slice("CHAINLINK_PRICE_FEED:".length);
      return chainlinkResult(this, requirement, context, `Chainlink ${pair}`, pair);
    }
    return chainlinkResult(this, requirement, context, "Chainlink", null);
  },
};
