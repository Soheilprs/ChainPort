import { draft, looksLikeAddress } from "../action.js";
import type { MigrationRule } from "../types.js";

export const tokenAddressMigrationRule: MigrationRule = {
  id: "token-address",
  version: "1",
  supports(finding) {
    return finding.ruleId === "token-availability" && finding.status !== "PASS";
  },
  createActions(finding, context) {
    const symbol =
      typeof finding.registryEvidence.symbol === "string"
        ? finding.registryEvidence.symbol
        : (finding.requirementKey ?? "TOKEN");
    if (finding.status === "BLOCKER") {
      return [
        draft({
          finding,
          key: `token-blocked:${symbol}`,
          ruleId: this.id,
          ruleVersion: this.version,
          title: `Required token ${symbol} is unavailable on ${context.targetChainName}`,
          description: `Migration cannot remap ${symbol}; the target registry marks it unavailable. No substitute token is assumed.`,
          technicalReason: finding.technicalReason,
          category: "BLOCKED_INFRASTRUCTURE",
          stage: "TOKEN_MAPPINGS",
          automationLevel: "BLOCKED",
          riskLevel: "CRITICAL",
          actionStatus: "BLOCKED",
          sourceValue: finding.sourceValue,
          targetValue: finding.targetValue,
        }),
      ];
    }
    if (finding.status === "UNKNOWN" || !looksLikeAddress(finding.targetValue)) {
      return [
        draft({
          finding,
          key: `token-unknown:${symbol}`,
          ruleId: this.id,
          ruleVersion: this.version,
          title: `Verify ${symbol} deployment on ${context.targetChainName}`,
          description: `ChainPort cannot produce a ${symbol} address mapping because the target deployment is not verified.`,
          technicalReason: finding.technicalReason,
          category: "TOKEN_ADDRESS",
          stage: "TOKEN_MAPPINGS",
          automationLevel: "UNKNOWN",
          riskLevel: "HIGH",
          actionStatus: "UNKNOWN",
          sourceValue: finding.sourceValue,
          targetValue: finding.targetValue,
        }),
      ];
    }
    const weth = symbol === "WETH";
    return [
      draft({
        finding,
        key: `token:${symbol}:${finding.sourceValue}->${finding.targetValue}`,
        ruleId: this.id,
        ruleVersion: this.version,
        title: `Remap ${symbol} from ${context.sourceChainName} to ${context.targetChainName}`,
        description: weth
          ? `Replace the source wrapped-native address with the catalogued ${context.targetChainName} WETH address. Wrapped-native variants differ by chain, so this mapping needs review.`
          : `Replace the source-chain ${symbol} address with the verified ${context.targetChainName} ${symbol} address. USDC is not substituted with USDT or another token.`,
        technicalReason: finding.technicalReason,
        category: "TOKEN_ADDRESS",
        stage: "TOKEN_MAPPINGS",
        automationLevel: weth ? "REVIEW_REQUIRED" : "SAFE_AUTOMATIC",
        riskLevel: weth ? "MEDIUM" : "LOW",
        actionStatus: "PLANNED",
        sourceValue: finding.sourceValue,
        targetValue: finding.targetValue,
        dependsOnKeys: [`chain-id:${context.sourceChainId}->${context.targetChainId}`],
      }),
    ];
  },
};
