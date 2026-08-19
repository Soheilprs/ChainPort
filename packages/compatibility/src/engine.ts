import { hashTargetSnapshot, type TargetCapabilitySnapshot } from "@chainport/chain-registry";

import { determineReadiness } from "./readiness.js";
import { COMPATIBILITY_RULES, evmSolidityPass, unmappedRequirementRule } from "./rules/index.js";
import { scoreFindings } from "./scoring.js";
import { shouldSkipRequirement } from "./skip.js";
import type {
  CompatibilityContext,
  CompatibilityEvaluation,
  CompatibilityReport,
  CompatibilityRequirement,
} from "./types.js";
import { COMPATIBILITY_RULESET_VERSION } from "./version.js";

export interface EvaluateCompatibilityInput {
  sourceChainKey: string;
  sourceChainId: number;
  sourceChainName: string;
  targetChainKey: string;
  targetChainId: number;
  targetChainName: string;
  snapshot: TargetCapabilitySnapshot;
  requirements: readonly CompatibilityRequirement[];
  hasSolidityContracts: boolean;
}

export function evaluateCompatibility(input: EvaluateCompatibilityInput): CompatibilityReport {
  const hashed = hashTargetSnapshot(input.snapshot);
  const context: CompatibilityContext = {
    sourceChainKey: input.sourceChainKey,
    sourceChainId: input.sourceChainId,
    sourceChainName: input.sourceChainName,
    targetChainKey: input.targetChainKey,
    targetChainId: input.targetChainId,
    targetChainName: input.targetChainName,
    snapshot: input.snapshot,
    hasSolidityContracts: input.hasSolidityContracts,
  };

  const findings: CompatibilityEvaluation[] = [];
  for (const requirement of input.requirements) {
    if (shouldSkipRequirement(requirement)) {
      continue;
    }
    const rule = COMPATIBILITY_RULES.find((item) => item.supports(requirement));
    const evaluation = (rule ?? unmappedRequirementRule).evaluate(requirement, context);
    if (evaluation !== null) {
      findings.push(evaluation);
    }
  }

  if (
    input.hasSolidityContracts &&
    !findings.some((item) => item.category === "CONTRACTS" && item.status === "PASS")
  ) {
    findings.push(evmSolidityPass(context));
  }

  const scored = scoreFindings(findings);
  return {
    rulesetVersion: COMPATIBILITY_RULESET_VERSION,
    registryVersion: hashed.snapshot.registryVersion,
    registrySnapshotHash: hashed.hash,
    sourceChainKey: input.sourceChainKey,
    targetChainKey: input.targetChainKey,
    score: scored.score,
    coverage: scored.coverage,
    coverageConfidence: scored.coverageConfidence,
    readiness: determineReadiness({
      blockerCount: scored.counts.blocker,
      warningCount: scored.counts.warning,
      unknownCount: scored.counts.unknown,
      coverage: scored.coverage,
    }),
    findings,
    categories: scored.categories,
    counts: scored.counts,
  };
}
