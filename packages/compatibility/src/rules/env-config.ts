import { findingConfidence } from "../confidence.js";
import { evaluation } from "../evaluation.js";
import type { CompatibilityRule } from "../types.js";

const NETWORK_ENV = /RPC|CHAIN_ID|EXPLORER|NETWORK|CHAIN/i;

export const envConfigRule: CompatibilityRule = {
  id: "env-config",
  version: "1",
  supports(requirement) {
    return requirement.key === "ENV_KEY" && NETWORK_ENV.test(requirement.detectedValue);
  },
  evaluate(requirement, context) {
    return evaluation(this, {
      status: "WARNING",
      category: "CONFIGURATION",
      requirementId: requirement.id,
      title: "Environment network configuration must be updated",
      summary: `Template key ${requirement.detectedValue} is source-network configuration and must be replaced for ${context.targetChainName}.`,
      technicalReason:
        "Environment templates record chain-specific RPC, chain ID, or explorer settings. This is a configuration change, not a missing chain capability.",
      sourceValue: requirement.normalizedValue,
      targetValue:
        /RPC/i.test(requirement.detectedValue) && context.snapshot.rpcUrls[0]
          ? context.snapshot.rpcUrls[0]
          : String(context.targetChainId),
      confidence: findingConfidence(requirement.confidence, "VERIFIED"),
      remediationType: "CONFIG_CHANGE",
      registryEvidence: {
        envKey: requirement.detectedValue,
        targetChainId: String(context.targetChainId),
        targetRpcUrls: [...context.snapshot.rpcUrls],
      },
    });
  },
};
