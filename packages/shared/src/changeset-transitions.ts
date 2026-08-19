import { DomainValidationError } from "./errors.js";
import { isChangeSetStatus, type ChangeSetStatus } from "./enums.js";

export const ALLOWED_CHANGESET_TRANSITIONS: Readonly<
  Record<ChangeSetStatus, readonly ChangeSetStatus[]>
> = {
  QUEUED: ["MATERIALIZING", "FAILED"],
  MATERIALIZING: ["GENERATING", "FAILED"],
  GENERATING: ["READY_FOR_REVIEW", "FAILED"],
  READY_FOR_REVIEW: ["FINALIZING", "FAILED"],
  FINALIZING: ["FINALIZED", "FAILED"],
  FINALIZED: ["ROLLED_BACK"],
  FAILED: ["QUEUED"],
  ROLLED_BACK: [],
};

export class InvalidChangeSetTransitionError extends DomainValidationError {
  public constructor(
    public readonly fromStatus: ChangeSetStatus,
    public readonly toStatus: ChangeSetStatus,
  ) {
    super(`invalid changeset transition ${fromStatus} → ${toStatus}`);
    this.name = "InvalidChangeSetTransitionError";
  }
}

export function isChangeSetTransitionAllowed(
  fromStatus: ChangeSetStatus,
  toStatus: ChangeSetStatus,
): boolean {
  return ALLOWED_CHANGESET_TRANSITIONS[fromStatus].includes(toStatus);
}

export function assertChangeSetTransition(
  fromStatus: ChangeSetStatus,
  toStatus: ChangeSetStatus,
): void {
  if (!isChangeSetStatus(fromStatus) || !isChangeSetStatus(toStatus)) {
    throw new DomainValidationError("changeset status is invalid");
  }
  if (!isChangeSetTransitionAllowed(fromStatus, toStatus)) {
    throw new InvalidChangeSetTransitionError(fromStatus, toStatus);
  }
}

export function buildChangeSetIdempotencyKey(input: {
  migrationPlanId: string;
  originalCommitSha: string;
  engineVersion: string;
}): string {
  return [
    "changeset",
    input.migrationPlanId,
    input.originalCommitSha.toLowerCase(),
    input.engineVersion,
  ].join(":");
}
