export const MIGRATION_PLAN_ERROR_CODES = [
  "INVALID_REQUEST",
  "COMPATIBILITY_NOT_FOUND",
  "COMPATIBILITY_NOT_COMPLETE",
  "PLAN_NOT_FOUND",
  "PLANNING_FAILED",
] as const;

export type MigrationPlanErrorCode = (typeof MIGRATION_PLAN_ERROR_CODES)[number];

export const MIGRATION_PLAN_ERROR_MESSAGES: Record<MigrationPlanErrorCode, string> = {
  INVALID_REQUEST: "Request is invalid",
  COMPATIBILITY_NOT_FOUND: "Compatibility report not found",
  COMPATIBILITY_NOT_COMPLETE: "Compatibility evaluation must complete before migration planning",
  PLAN_NOT_FOUND: "Migration plan not found",
  PLANNING_FAILED: "Migration planning failed",
};
