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
        key: `unknown-address:${finding.sourceValue ?? finding.id}`,
        ruleId: this.id,
        ruleVersion: this.version,
        title: `Unclassified contract address needs verification on ${context.targetChainName}`,
        description: `A hardcoded address is not in the token or infrastructure catalog, so ChainPort cannot map it. This is not a fabricated equivalent and not a blocker.`,
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
