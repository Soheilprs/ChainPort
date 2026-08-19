import { draft, looksLikeAddress } from "../action.js";
import type { MigrationRule } from "../types.js";

const INFRA = new Set(["infrastructure-contract", "uniswap"]);

export const infrastructureAddressMigrationRule: MigrationRule = {
  id: "infrastructure-address",
  version: "1",
  supports(finding) {
    return INFRA.has(finding.ruleId) && finding.status !== "PASS";
  },
  createActions(finding, context) {
    const name = finding.requirementKey ?? finding.ruleId;
    if (finding.status === "BLOCKER") {
      return [
        draft({
          finding,
          key: `infra-blocked:${name}`,
          ruleId: this.id,
          ruleVersion: this.version,
          title: `Required ${name} is unavailable on ${context.targetChainName}`,
          description: `The target registry marks ${name} unavailable. No alternate protocol is substituted.`,
          technicalReason: finding.technicalReason,
          category: "BLOCKED_INFRASTRUCTURE",
          stage: "INFRASTRUCTURE_CONTRACTS",
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
          key: `infra-unknown:${name}`,
          ruleId: this.id,
          ruleVersion: this.version,
          title: `Verify ${name} on ${context.targetChainName}`,
          description: `ChainPort cannot produce a ${name} migration action because target availability is not verified.`,
          technicalReason: finding.technicalReason,
          category: "INFRASTRUCTURE_ADDRESS",
          stage: "INFRASTRUCTURE_CONTRACTS",
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
        key: `infra:${name}`,
        ruleId: this.id,
        ruleVersion: this.version,
        title: `Review ${name} target mapping for ${context.targetChainName}`,
        description: looksLikeAddress(finding.targetValue)
          ? `${name} has a catalogued target value ${finding.targetValue}. Confirm deployment semantics before automation.`
          : `${name} is recorded as available on ${context.targetChainName}, but no verified address mapping is catalogued.`,
        technicalReason: finding.technicalReason,
        category: "INFRASTRUCTURE_ADDRESS",
        stage: "INFRASTRUCTURE_CONTRACTS",
        automationLevel: "REVIEW_REQUIRED",
        riskLevel: "MEDIUM",
        actionStatus: "PLANNED",
        sourceValue: finding.sourceValue,
        targetValue: finding.targetValue,
        dependsOnKeys: [`chain-id:${context.sourceChainId}->${context.targetChainId}`],
      }),
    ];
  },
};
