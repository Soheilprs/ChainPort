import { getChainByChainId } from "@chainport/chain-registry";

import { findingConfidence } from "../confidence.js";
import { evaluation } from "../evaluation.js";
import { isFrontendPath } from "../paths.js";
import type { CompatibilityRule } from "../types.js";

export const chainIdCompatibilityRule: CompatibilityRule = {
  id: "chain-id",
  version: "1",
  supports(requirement) {
    return requirement.key === "HARDCODED_CHAIN_ID";
  },
  evaluate(requirement, context) {
    const detectedId = Number(requirement.detectedValue);
    const detectedChain = Number.isFinite(detectedId) ? getChainByChainId(detectedId) : undefined;
    const frontend = requirement.evidenceFilePaths.some(isFrontendPath);
    const category = frontend ? "FRONTEND" : "CONFIGURATION";
    const sourceValue = `${detectedId}${detectedChain ? ` (${detectedChain.name})` : ""}`;
    const targetValue = `${context.targetChainId} (${context.targetChainName})`;
    const registryEvidence = {
      detectedChainId: requirement.detectedValue,
      selectedSourceChainId: String(context.sourceChainId),
      targetChainId: String(context.targetChainId),
    };

    if (detectedId === context.targetChainId) {
      return evaluation(this, {
        status: "PASS",
        category,
        requirementId: requirement.id,
        title: "Network chain ID already matches the target",
        summary: `Hardcoded chain ID ${detectedId} already equals ${context.targetChainName}.`,
        technicalReason: "The detected chain ID is the selected target chain ID.",
        sourceValue,
        targetValue,
        confidence: findingConfidence(requirement.confidence, "VERIFIED"),
        remediationType: "NONE",
        registryEvidence,
      });
    }

    const mismatch =
      Number.isFinite(detectedId) && detectedId !== context.sourceChainId
        ? "SOURCE_CHAIN_CONFIGURATION_MISMATCH"
        : null;
    const title = mismatch
      ? "Source chain configuration mismatch"
      : "Source-chain network configuration must be updated";
    const summary = mismatch
      ? `Repository hardcodes chain ID ${detectedId}${detectedChain ? ` (${detectedChain.name})` : ""}, but the selected source chain is ${context.sourceChainName} (${context.sourceChainId}). Target is ${context.targetChainName} (${context.targetChainId}).`
      : `Application contains source-chain-specific network configuration and must be updated for target chain ID ${context.targetChainId}.`;

    return evaluation(this, {
      status: "WARNING",
      category,
      requirementId: requirement.id,
      title,
      summary,
      technicalReason: mismatch
        ? `Detected chain ID ${detectedId} matches neither the selected source (${context.sourceChainId}) nor the target (${context.targetChainId}).`
        : `Detected chain ID ${detectedId} is the source network and differs from target chain ID ${context.targetChainId}. This is configuration, not a runtime capability gap.`,
      sourceValue,
      targetValue,
      confidence: findingConfidence(requirement.confidence, "VERIFIED"),
      remediationType: "CONFIG_CHANGE",
      registryEvidence: mismatch ? { ...registryEvidence, code: mismatch } : registryEvidence,
    });
  },
};
