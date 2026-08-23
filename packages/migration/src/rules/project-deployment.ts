import { draft } from "../action.js";
import type { MigrationRule } from "../types.js";

export const projectDeploymentMigrationRule: MigrationRule = {
  id: "project-deployment",
  version: "1",
  supports(finding) {
    return finding.ruleId === "project-deployment" && finding.status !== "PASS";
  },
  createActions(finding, context) {
    const name =
      typeof finding.registryEvidence.contractName === "string"
        ? finding.registryEvidence.contractName
        : (finding.sourceValue ?? "project contract");
    return [
      draft({
        finding,
        key: `project-deployment:${name}`,
        ruleId: this.id,
        ruleVersion: this.version,
        title: `Redeploy ${name} on ${context.targetChainName}`,
        description: `${name} is a repository contract with source-chain deployment addresses. Redeploy it on ${context.targetChainName} and replace every stored address.`,
        technicalReason: finding.technicalReason,
        category: "ENV_CONFIG",
        stage: "DEPLOYMENT_CONFIGURATION",
        automationLevel: "REVIEW_REQUIRED",
        riskLevel: "MEDIUM",
        actionStatus: "PLANNED",
        sourceValue: finding.sourceValue,
        targetValue: null,
      }),
    ];
  },
};
