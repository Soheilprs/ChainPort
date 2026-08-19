import type { ImplementationStatus } from "@chainport/shared";

export const MIGRATION_IMPLEMENTATION_STATUS =
  "implemented" as const satisfies ImplementationStatus;

export { CyclicMigrationDependencyError, topologicalOrder } from "./dependencies.js";
export { createMigrationPlan, type CreateMigrationPlanInput } from "./engine.js";
export { MIGRATION_RULES } from "./rules/index.js";
export { autoFixablePercent, countActions, determinePlanOutcome } from "./status.js";
export type {
  MigrationActionDraft,
  MigrationPlanResult,
  MigrationRule,
  OrderedMigrationAction,
  PlanContext,
  PlannedEvidence,
  PlannedFinding,
} from "./types.js";
export { MIGRATION_RULESET_VERSION } from "./version.js";
