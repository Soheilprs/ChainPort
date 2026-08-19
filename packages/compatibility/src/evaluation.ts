import type { CompatibilityEvaluation, CompatibilityRule } from "./types.js";

export function evaluation(
  rule: Pick<CompatibilityRule, "id" | "version">,
  rest: Omit<CompatibilityEvaluation, "ruleId" | "ruleVersion">,
): CompatibilityEvaluation {
  return {
    ruleId: rule.id,
    ruleVersion: rule.version,
    ...rest,
  };
}
