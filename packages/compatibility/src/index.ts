import type { ImplementationStatus } from "@chainport/shared";

export const COMPATIBILITY_IMPLEMENTATION_STATUS =
  "implemented" as const satisfies ImplementationStatus;

export { evaluateCompatibility, type EvaluateCompatibilityInput } from "./engine.js";
export { determineReadiness } from "./readiness.js";
export { COMPATIBILITY_RULES } from "./rules/index.js";
export { scoreFindings } from "./scoring.js";
export { shouldSkipRequirement } from "./skip.js";
export type {
  CategoryScore,
  CompatibilityContext,
  CompatibilityEvaluation,
  CompatibilityReport,
  CompatibilityRequirement,
  CompatibilityRule,
} from "./types.js";
export { COMPATIBILITY_RULESET_VERSION } from "./version.js";
