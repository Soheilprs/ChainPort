import { draft } from "../action.js";
import type { MigrationRule } from "../types.js";

export const chainIdMigrationRule: MigrationRule = {
  id: "chain-id",
  version: "1",
  supports(finding) {
    return finding.ruleId === "chain-id" && finding.status !== "PASS";
  },
  createActions(finding, context) {
    const frontend = finding.category === "FRONTEND";
    return [
      draft({
        finding,
        key: frontend
          ? `frontend-chain-id:${context.sourceChainId}->${context.targetChainId}`
          : `chain-id:${context.sourceChainId}->${context.targetChainId}`,
        ruleId: this.id,
        ruleVersion: this.version,
        title: frontend
          ? `Update frontend chain ID from ${context.sourceChainName} to ${context.targetChainName}`
          : `Replace ${context.sourceChainName} chain ID ${context.sourceChainId} with ${context.targetChainName} chain ID ${context.targetChainId}`,
        description: frontend
          ? `Frontend network configuration still targets ${context.sourceChainName} (${context.sourceChainId}) and must use ${context.targetChainName} (${context.targetChainId}).`
          : `Network configuration hardcodes chain ID ${context.sourceChainId} (${context.sourceChainName}). Replace it with ${context.targetChainId} (${context.targetChainName}).`,
        technicalReason: finding.technicalReason,
        category: frontend ? "FRONTEND_NETWORK" : "CHAIN_ID",
        stage: frontend ? "FRONTEND_CONFIGURATION" : "NETWORK_CONFIGURATION",
        automationLevel: "SAFE_AUTOMATIC",
        riskLevel: "LOW",
        actionStatus: "PLANNED",
        sourceValue: finding.sourceValue ?? String(context.sourceChainId),
        targetValue: String(context.targetChainId),
        dependsOnKeys: frontend
          ? [`chain-id:${context.sourceChainId}->${context.targetChainId}`]
          : [],
      }),
    ];
  },
};
