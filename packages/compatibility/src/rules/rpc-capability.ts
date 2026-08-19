import { lookupRpcMethod } from "@chainport/chain-registry";

import { findingConfidence } from "../confidence.js";
import { evaluation } from "../evaluation.js";
import type { CompatibilityRule } from "../types.js";

export const rpcCapabilityRule: CompatibilityRule = {
  id: "rpc-capability",
  version: "1",
  supports(requirement) {
    return requirement.key === "RPC_METHOD";
  },
  evaluate(requirement, context) {
    const method = requirement.normalizedValue;
    const capability = lookupRpcMethod(context.snapshot, method);
    const availability = capability?.availability ?? "UNKNOWN";
    const provenance = capability?.provenance ?? "UNKNOWN";
    const registryEvidence = {
      method,
      availability,
      provenance,
    };

    if (availability === "AVAILABLE") {
      return evaluation(this, {
        status: "PASS",
        category: "RPC",
        requirementId: requirement.id,
        title: `${method} is available on the target chain`,
        summary: `Registry lists ${method} as available on ${context.targetChainName}.`,
        technicalReason: "Target RPC capability snapshot records this method as available.",
        sourceValue: method,
        targetValue: "AVAILABLE",
        confidence: findingConfidence(requirement.confidence, provenance),
        remediationType: "NONE",
        registryEvidence,
      });
    }

    if (availability === "UNAVAILABLE") {
      const blocker = requirement.confidence === "DETECTED";
      return evaluation(this, {
        status: blocker ? "BLOCKER" : "WARNING",
        category: "RPC",
        requirementId: requirement.id,
        title: `${method} is not available on the target chain`,
        summary: `The project requires ${method}, and the ${context.targetChainName} registry explicitly marks it unavailable.`,
        technicalReason:
          "RPC capability was not inferred from EVM compatibility. The snapshot records this method as unavailable.",
        sourceValue: method,
        targetValue: "UNAVAILABLE",
        confidence: findingConfidence(requirement.confidence, provenance),
        remediationType: blocker ? "INFRASTRUCTURE_REQUIRED" : "MANUAL_REVIEW",
        registryEvidence,
      });
    }

    return evaluation(this, {
      status: "UNKNOWN",
      category: "RPC",
      requirementId: requirement.id,
      title: `${method} target support is unverified`,
      summary: `The project requires ${method}, but ChainPort has no verified ${context.targetChainName} data for this RPC method.`,
      technicalReason:
        "UNKNOWN is not a blocker. EVM compatibility does not imply debug or extended RPC methods.",
      sourceValue: method,
      targetValue: "UNKNOWN",
      confidence: "LOW",
      remediationType: "UNKNOWN",
      registryEvidence,
    });
  },
};
