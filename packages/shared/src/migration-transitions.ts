import { DomainValidationError } from "./errors.js";
import { isMigrationPlanRunStatus, type MigrationPlanRunStatus } from "./enums.js";

export const ALLOWED_MIGRATION_PLAN_TRANSITIONS: Readonly<
  Record<MigrationPlanRunStatus, readonly MigrationPlanRunStatus[]>
> = {
  QUEUED: ["PLANNING", "FAILED"],
  PLANNING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: ["QUEUED"],
};

export class InvalidMigrationPlanTransitionError extends DomainValidationError {
  public constructor(
    public readonly fromStatus: MigrationPlanRunStatus,
    public readonly toStatus: MigrationPlanRunStatus,
  ) {
    super(`invalid migration plan transition ${fromStatus} → ${toStatus}`);
    this.name = "InvalidMigrationPlanTransitionError";
  }
}

export function isMigrationPlanTransitionAllowed(
  fromStatus: MigrationPlanRunStatus,
  toStatus: MigrationPlanRunStatus,
): boolean {
  return ALLOWED_MIGRATION_PLAN_TRANSITIONS[fromStatus].includes(toStatus);
}

export function assertMigrationPlanTransition(
  fromStatus: MigrationPlanRunStatus,
  toStatus: MigrationPlanRunStatus,
): void {
  if (!isMigrationPlanRunStatus(fromStatus) || !isMigrationPlanRunStatus(toStatus)) {
    throw new DomainValidationError("migration plan status is invalid");
  }
  if (!isMigrationPlanTransitionAllowed(fromStatus, toStatus)) {
    throw new InvalidMigrationPlanTransitionError(fromStatus, toStatus);
  }
}

export function buildMigrationPlanIdempotencyKey(input: {
  compatibilityRunId: string;
  migrationRulesetVersion: string;
}): string {
  return ["plan", input.compatibilityRunId, input.migrationRulesetVersion].join(":");
}
