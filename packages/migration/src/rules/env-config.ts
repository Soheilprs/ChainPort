import { draft, jsonList } from "../action.js";
import type { MigrationRule } from "../types.js";

export const envConfigMigrationRule: MigrationRule = {
  id: "env-config",
  version: "1",
  supports(finding) {
    return finding.ruleId === "env-config" && finding.status !== "PASS";
  },
  createActions(finding, context) {
    const key =
      typeof finding.registryEvidence.envKey === "string"
        ? finding.registryEvidence.envKey
        : (finding.sourceValue ?? "ENV");
    const rpc = /RPC/i.test(key);
    const urls = jsonList(finding.registryEvidence.targetRpcUrls);
    const canonical = urls.length === 1 ? (urls[0] ?? null) : null;
    const target = rpc ? (canonical ?? urls.join(", ")) : String(context.targetChainId);
    const namedNetwork = /(SEPOLIA|GOERLI|HOLESKY|MAINNET|ARBITRUM|OPTIMISM|ETHEREUM|BASE)/i.test(
      key,
    );
    const namesTarget = new RegExp(context.targetChainKey.replaceAll("-", "_"), "i").test(key);
    const automatic = (rpc ? canonical !== null : true) && (!namedNetwork || namesTarget);
    return [
      draft({
        finding,
        key: `env:${key}`,
        ruleId: this.id,
        ruleVersion: this.version,
        title: `Update environment key ${key} for ${context.targetChainName}`,
        description:
          !automatic && namedNetwork && !namesTarget
            ? `Environment key ${key} names a network other than ${context.targetChainName}. Review before replacing its value.`
            : rpc
              ? automatic
                ? `Set ${key} to the catalogued ${context.targetChainName} RPC ${canonical}.`
                : `Set ${key} to a ${context.targetChainName} RPC. Multiple catalogued endpoints exist; do not auto-pick.`
              : `Set ${key} to ${context.targetChainName} chain ID ${context.targetChainId}.`,
        technicalReason: finding.technicalReason,
        category: "ENV_CONFIG",
        stage: rpc ? "RPC_AND_EXPLORER" : "NETWORK_CONFIGURATION",
        automationLevel: automatic ? "SAFE_AUTOMATIC" : "REVIEW_REQUIRED",
        riskLevel: "LOW",
        actionStatus: "PLANNED",
        sourceValue: finding.sourceValue,
        targetValue: target,
        dependsOnKeys: [`chain-id:${context.sourceChainId}->${context.targetChainId}`],
      }),
    ];
  },
};
