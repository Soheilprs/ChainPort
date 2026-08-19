import { draft } from "../action.js";
import type { MigrationRule } from "../types.js";

export const rpcCapabilityMigrationRule: MigrationRule = {
  id: "rpc-capability",
  version: "1",
  supports(finding) {
    return finding.ruleId === "rpc-capability" && finding.status !== "PASS";
  },
  createActions(finding, context) {
    const method = finding.sourceValue ?? "RPC method";
    if (finding.status === "BLOCKER") {
      return [
        draft({
          finding,
          key: `rpc-capability-blocked:${method}`,
          ruleId: this.id,
          ruleVersion: this.version,
          title: `Application depends on unsupported RPC method ${method}`,
          description: `${context.targetChainName} explicitly does not support ${method}. This is a network capability gap, not a public-RPC provider setting ChainPort can swap.`,
          technicalReason: finding.technicalReason,
          category: "RPC_CAPABILITY",
          stage: "RPC_AND_EXPLORER",
          automationLevel: "BLOCKED",
          riskLevel: "CRITICAL",
          actionStatus: "BLOCKED",
          sourceValue: method,
          targetValue: "UNAVAILABLE",
        }),
      ];
    }
    return [
      draft({
        finding,
        key: `rpc-capability-unknown:${method}`,
        ruleId: this.id,
        ruleVersion: this.version,
        title: `Verify RPC method ${method} on ${context.targetChainName}`,
        description: `ChainPort has no verified ${method} data for ${context.targetChainName}. EVM compatibility does not imply this method exists.`,
        technicalReason: finding.technicalReason,
        category: "RPC_CAPABILITY",
        stage: "RPC_AND_EXPLORER",
        automationLevel: "UNKNOWN",
        riskLevel: "HIGH",
        actionStatus: "UNKNOWN",
        sourceValue: method,
        targetValue: "UNKNOWN",
      }),
    ];
  },
};
