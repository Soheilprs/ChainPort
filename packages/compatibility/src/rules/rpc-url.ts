import { findingConfidence } from "../confidence.js";
import { evaluation } from "../evaluation.js";
import { isFrontendPath } from "../paths.js";
import type { CompatibilityRule } from "../types.js";

export const hardcodedRpcRule: CompatibilityRule = {
  id: "hardcoded-rpc",
  version: "1",
  supports(requirement) {
    return requirement.key === "RPC_URL";
  },
  evaluate(requirement, context) {
    const frontend = requirement.evidenceFilePaths.some(isFrontendPath);
    const targetRpc = context.snapshot.rpcUrls[0] ?? null;
    const alreadyTarget = context.snapshot.rpcUrls.some((url) =>
      requirement.normalizedValue.includes(url),
    );
    if (alreadyTarget) {
      return evaluation(this, {
        status: "PASS",
        category: frontend ? "FRONTEND" : "RPC",
        requirementId: requirement.id,
        title: "RPC endpoint already points at the target chain",
        summary: "The detected RPC URL matches a catalogued target endpoint.",
        technicalReason: "No source-chain RPC remap is required for this value.",
        sourceValue: requirement.normalizedValue,
        targetValue: targetRpc,
        confidence: findingConfidence(requirement.confidence, "VERIFIED"),
        remediationType: "NONE",
        registryEvidence: { targetRpcUrls: [...context.snapshot.rpcUrls] },
      });
    }
    return evaluation(this, {
      status: "WARNING",
      category: frontend ? "FRONTEND" : "RPC",
      requirementId: requirement.id,
      title: "Source-chain RPC endpoint must be replaced",
      summary: `Application contains a source-chain-specific RPC endpoint. ${context.targetChainName} public RPC ${targetRpc ?? "is catalogued in the registry"}.`,
      technicalReason:
        "A hardcoded RPC URL is configuration for the source network. Secrets redacted during analysis stay redacted.",
      sourceValue: requirement.normalizedValue,
      targetValue: targetRpc,
      confidence: findingConfidence(requirement.confidence, "VERIFIED"),
      remediationType: "CONFIG_CHANGE",
      registryEvidence: { targetRpcUrls: [...context.snapshot.rpcUrls] },
    });
  },
};
