import { draft } from "../action.js";
import type { MigrationRule } from "../types.js";

export const fallbackMigrationRule: MigrationRule = {
  id: "fallback",
  version: "1",
  supports(finding) {
    return finding.status !== "PASS";
  },
  createActions(finding, context) {
    if (finding.status === "BLOCKER") {
      return [
        draft({
          finding,
          key: `blocked:${finding.id}`,
          ruleId: this.id,
          ruleVersion: this.version,
          title: finding.title,
          description: `Required capability is unavailable on ${context.targetChainName}. Migration cannot proceed unchanged.`,
          technicalReason: finding.technicalReason,
          category: "BLOCKED_INFRASTRUCTURE",
          stage: "MANUAL_REVIEW",
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
          key: `unknown:${finding.id}`,
          ruleId: this.id,
          ruleVersion: this.version,
          title: finding.title,
          description: `ChainPort cannot produce a migration action because target data for this requirement is unverified.`,
          technicalReason: finding.technicalReason,
          category: "UNKNOWN_ADDRESS",
          stage: "MANUAL_REVIEW",
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
        key: `review:${finding.id}`,
        ruleId: this.id,
        ruleVersion: this.version,
        title: finding.title,
        description: finding.summary,
        technicalReason: finding.technicalReason,
        category: "ENV_CONFIG",
        stage: "MANUAL_REVIEW",
        automationLevel: "REVIEW_REQUIRED",
        riskLevel: "MEDIUM",
        actionStatus: "PLANNED",
        sourceValue: finding.sourceValue,
        targetValue: finding.targetValue,
      }),
    ];
  },
};
