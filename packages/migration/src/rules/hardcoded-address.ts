import { draft } from "../action.js";
import type { MigrationRule } from "../types.js";

export const unknownAddressMigrationRule: MigrationRule = {
  id: "unknown-address",
  version: "1",
  supports(finding) {
    return finding.ruleId === "hardcoded-address" && finding.status !== "PASS";
  },
  createActions(finding, context) {
    return [
      draft({
        finding,
        key: "unknown-address",
        ruleId: this.id,
        ruleVersion: this.version,
        title: `Identify unclassified hardcoded addresses on ${context.targetChainName}`,
        description: `Hardcoded addresses are not in the token or infrastructure catalog, so ChainPort cannot map them. Identify each contract and confirm whether a ${context.targetChainName} deployment exists. This is not a fabricated equivalent and not a blocker.`,
        technicalReason: finding.technicalReason,
        category: "UNKNOWN_ADDRESS",
        stage: "MANUAL_REVIEW",
        automationLevel: "UNKNOWN",
        riskLevel: "MEDIUM",
        actionStatus: "UNKNOWN",
        sourceValue: finding.sourceValue,
        targetValue: null,
      }),
    ];
  },
};
