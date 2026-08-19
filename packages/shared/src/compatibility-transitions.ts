import { DomainValidationError } from "./errors.js";
import { isCompatibilityRunStatus, type CompatibilityRunStatus } from "./enums.js";

export const ALLOWED_COMPATIBILITY_TRANSITIONS: Readonly<
  Record<CompatibilityRunStatus, readonly CompatibilityRunStatus[]>
> = {
  QUEUED: ["EVALUATING", "FAILED"],
  EVALUATING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: ["QUEUED"],
};

export class InvalidCompatibilityTransitionError extends DomainValidationError {
  public constructor(
    public readonly fromStatus: CompatibilityRunStatus,
    public readonly toStatus: CompatibilityRunStatus,
  ) {
    super(`invalid compatibility transition ${fromStatus} → ${toStatus}`);
    this.name = "InvalidCompatibilityTransitionError";
  }
}

export function isCompatibilityTransitionAllowed(
  fromStatus: CompatibilityRunStatus,
  toStatus: CompatibilityRunStatus,
): boolean {
  return ALLOWED_COMPATIBILITY_TRANSITIONS[fromStatus].includes(toStatus);
}

export function assertCompatibilityTransition(
  fromStatus: CompatibilityRunStatus,
  toStatus: CompatibilityRunStatus,
): void {
  if (!isCompatibilityRunStatus(fromStatus) || !isCompatibilityRunStatus(toStatus)) {
    throw new DomainValidationError("compatibility status is invalid");
  }
  if (!isCompatibilityTransitionAllowed(fromStatus, toStatus)) {
    throw new InvalidCompatibilityTransitionError(fromStatus, toStatus);
  }
}

export function buildCompatibilityIdempotencyKey(input: {
  analysisId: string;
  targetChainKey: string;
  rulesetVersion: string;
  registrySnapshotHash: string;
}): string {
  return [
    "compat",
    input.analysisId,
    input.targetChainKey,
    input.rulesetVersion,
    input.registrySnapshotHash,
  ].join(":");
}
