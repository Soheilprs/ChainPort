import { draft, jsonList } from "../action.js";
import type { MigrationRule } from "../types.js";

export const rpcUrlMigrationRule: MigrationRule = {
  id: "rpc-url",
  version: "1",
  supports(finding) {
    return finding.ruleId === "hardcoded-rpc" && finding.status !== "PASS";
  },
  createActions(finding, context) {
    const options = jsonList(finding.registryEvidence.targetRpcUrls);
    const urls = options.length > 0 ? options : [...context.targetRpcUrls];
    const canonical = urls.length === 1 ? (urls[0] ?? null) : null;
    const frontend = finding.category === "FRONTEND";
    const automatic = canonical !== null;
    return [
      draft({
        finding,
        key: frontend
          ? `frontend-rpc:${finding.sourceValue ?? ""}`
          : `rpc-url:${finding.sourceValue ?? ""}`,
        ruleId: this.id,
        ruleVersion: this.version,
        title: `Replace source-chain RPC endpoint for ${context.targetChainName}`,
        description: automatic
          ? `Replace the detected source RPC with the catalogued ${context.targetChainName} endpoint ${canonical}.`
          : `Replace the detected source RPC. ${context.targetChainName} has ${urls.length} catalogued endpoints; choose one rather than auto-selecting.`,
        technicalReason: finding.technicalReason,
        category: frontend ? "FRONTEND_NETWORK" : "RPC_URL",
        stage: frontend ? "FRONTEND_CONFIGURATION" : "RPC_AND_EXPLORER",
        automationLevel: automatic ? "SAFE_AUTOMATIC" : "REVIEW_REQUIRED",
        riskLevel: "LOW",
        actionStatus: "PLANNED",
        sourceValue: finding.sourceValue,
        targetValue: canonical ?? urls.join(", "),
        dependsOnKeys: [`chain-id:${context.sourceChainId}->${context.targetChainId}`],
        registryRefs: { ...finding.registryEvidence, targetRpcUrls: urls },
      }),
    ];
  },
};
