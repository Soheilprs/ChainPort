import { draft } from "../action.js";
import type { MigrationRule } from "../types.js";

export const crossChainMigrationRule: MigrationRule = {
  id: "cross-chain",
  version: "1",
  supports(finding) {
    return finding.ruleId === "layerzero" && finding.status !== "PASS";
  },
  createActions(finding, context) {
    if (finding.status === "BLOCKER") {
      return [
        draft({
          finding,
          key: "cross-chain-blocked:LAYERZERO",
          ruleId: this.id,
          ruleVersion: this.version,
          title: `LayerZero is unsupported on ${context.targetChainName}`,
          description:
            "Migration cannot remap this cross-chain integration. Another bridge is not treated as a substitute.",
          technicalReason: finding.technicalReason,
          category: "BLOCKED_INFRASTRUCTURE",
          stage: "CROSS_CHAIN",
          automationLevel: "BLOCKED",
          riskLevel: "CRITICAL",
          actionStatus: "BLOCKED",
          sourceValue: finding.sourceValue,
          targetValue: finding.targetValue,
        }),
      ];
    }
    if (finding.status === "UNKNOWN") {
      return [
        draft({
          finding,
          key: "cross-chain-unknown:LAYERZERO",
          ruleId: this.id,
          ruleVersion: this.version,
          title: `Verify LayerZero on ${context.targetChainName}`,
          description: `ChainPort cannot produce a migration action because LayerZero availability on ${context.targetChainName} is not verified. This does not mean LayerZero is unavailable.`,
          technicalReason: finding.technicalReason,
          category: "CROSS_CHAIN",
          stage: "CROSS_CHAIN",
          automationLevel: "UNKNOWN",
          riskLevel: "HIGH",
          actionStatus: "UNKNOWN",
          sourceValue: finding.sourceValue,
          targetValue: finding.targetValue,
        }),
      ];
    }
    return [
      draft({
        finding,
        key: "cross-chain:LAYERZERO",
        ruleId: this.id,
        ruleVersion: this.version,
        title: `Review LayerZero endpoint configuration for ${context.targetChainName}`,
        description: `LayerZero is catalogued on ${context.targetChainName}. Cross-chain endpoint remaps are security-sensitive and stay review-required.`,
        technicalReason: finding.technicalReason,
        category: "CROSS_CHAIN",
        stage: "CROSS_CHAIN",
        automationLevel: "REVIEW_REQUIRED",
        riskLevel: "HIGH",
        actionStatus: "PLANNED",
        sourceValue: finding.sourceValue,
        targetValue: finding.targetValue,
      }),
    ];
  },
};
