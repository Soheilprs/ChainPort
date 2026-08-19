import { evaluation } from "../evaluation.js";
import type { CompatibilityContext, CompatibilityEvaluation } from "../types.js";

export const FRAMEWORK_RULE_ID = "framework-compatibility";
export const FRAMEWORK_RULE_VERSION = "1";

export function evmSolidityPass(context: CompatibilityContext): CompatibilityEvaluation {
  return evaluation(
    { id: FRAMEWORK_RULE_ID, version: FRAMEWORK_RULE_VERSION },
    {
      status: "PASS",
      category: "CONTRACTS",
      requirementId: null,
      title: "Solidity contracts are EVM-compatible on the target",
      summary: `${context.targetChainName} is an EVM chain (${context.snapshot.evmVersion}); detected Solidity contracts do not require a language change.`,
      technicalReason:
        "This is a category-level compatibility note. It does not imply tokens, oracles, or RPC methods exist.",
      sourceValue: "solidity",
      targetValue: `evm:${context.snapshot.evmVersion}`,
      confidence: "HIGH",
      remediationType: "NONE",
      registryEvidence: {
        family: context.snapshot.family,
        evmVersion: context.snapshot.evmVersion,
      },
    },
  );
}
