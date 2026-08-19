import { DomainValidationError } from "./errors.js";
import { isValidationRunStatus, type ValidationRunStatus } from "./enums.js";

export const ALLOWED_VALIDATION_TRANSITIONS: Readonly<
  Record<ValidationRunStatus, readonly ValidationRunStatus[]>
> = {
  QUEUED: ["PREPARING", "FAILED"],
  PREPARING: ["INSTALLING", "BUILDING", "TESTING", "COMPLETED", "FAILED", "TIMED_OUT"],
  INSTALLING: ["BUILDING", "COMPLETED", "FAILED", "TIMED_OUT"],
  BUILDING: ["TESTING", "COMPLETED", "FAILED", "TIMED_OUT"],
  TESTING: ["COMPLETED", "FAILED", "TIMED_OUT"],
  COMPLETED: [],
  FAILED: ["QUEUED"],
  TIMED_OUT: [],
};

export class InvalidValidationTransitionError extends DomainValidationError {
  public constructor(
    public readonly fromStatus: ValidationRunStatus,
    public readonly toStatus: ValidationRunStatus,
  ) {
    super(`invalid validation transition ${fromStatus} → ${toStatus}`);
    this.name = "InvalidValidationTransitionError";
  }
}

export function isValidationTransitionAllowed(
  fromStatus: ValidationRunStatus,
  toStatus: ValidationRunStatus,
): boolean {
  return ALLOWED_VALIDATION_TRANSITIONS[fromStatus].includes(toStatus);
}

export function assertValidationTransition(
  fromStatus: ValidationRunStatus,
  toStatus: ValidationRunStatus,
): void {
  if (!isValidationRunStatus(fromStatus) || !isValidationRunStatus(toStatus)) {
    throw new DomainValidationError("validation status is invalid");
  }
  if (!isValidationTransitionAllowed(fromStatus, toStatus)) {
    throw new InvalidValidationTransitionError(fromStatus, toStatus);
  }
}

export function buildValidationIdempotencyKey(input: {
  repositoryRevisionId: string;
  revisionContentHash: string;
  engineVersion: string;
  sandboxImageDigest: string;
  profile: string;
}): string {
  return [
    "validation",
    input.repositoryRevisionId,
    input.revisionContentHash.toLowerCase(),
    input.engineVersion,
    input.sandboxImageDigest,
    input.profile,
  ].join(":");
}
