import { draft, looksLikeAddress } from "../action.js";
import type { MigrationRule } from "../types.js";

export const oracleMigrationRule: MigrationRule = {
  id: "oracle",
  version: "1",
  supports(finding) {
    return finding.ruleId === "oracle-availability" && finding.status !== "PASS";
  },
  createActions(finding, context) {
    const pair =
      typeof finding.registryEvidence.pair === "string" ? finding.registryEvidence.pair : null;
    const label = pair === null ? "Chainlink" : `Chainlink ${pair}`;
    if (finding.status === "BLOCKER") {
      return [
        draft({
          finding,
          key: `oracle-blocked:${label}`,
          ruleId: this.id,
          ruleVersion: this.version,
          title: `Required ${label} infrastructure is unavailable on ${context.targetChainName}`,
          description: `Migration cannot proceed unchanged. The target registry marks ${label} unavailable. No alternate oracle is recommended.`,
          technicalReason: finding.technicalReason,
          category: "BLOCKED_INFRASTRUCTURE",
          stage: "ORACLES",
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
          key: `oracle-unknown:${label}`,
          ruleId: this.id,
          ruleVersion: this.version,
          title: `Verify ${label} on ${context.targetChainName}`,
          description: `ChainPort cannot produce a migration action because ${label} availability on ${context.targetChainName} is not verified. This does not mean the oracle is unavailable.`,
          technicalReason: finding.technicalReason,
          category: "ORACLE_FEED",
          stage: "ORACLES",
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
        key: `oracle:${label}`,
        ruleId: this.id,
        ruleVersion: this.version,
        title: `Review ${label} remap for ${context.targetChainName}`,
        description: looksLikeAddress(finding.targetValue)
          ? `Remap ${label} to the catalogued target feed ${finding.targetValue}. Oracle decimals, heartbeat, and stale-price handling still need developer review.`
          : `${label} is available on ${context.targetChainName}, but no verified feed address is catalogued.`,
        technicalReason: finding.technicalReason,
        category: "ORACLE_FEED",
        stage: "ORACLES",
        automationLevel: "REVIEW_REQUIRED",
        riskLevel: "MEDIUM",
        actionStatus: "PLANNED",
        sourceValue: finding.sourceValue,
        targetValue: finding.targetValue,
      }),
    ];
  },
};
