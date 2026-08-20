import { DomainValidationError } from "./errors.js";
import { isDeploymentRunStatus, type DeploymentRunStatus } from "./enums.js";

export const ALLOWED_DEPLOYMENT_TRANSITIONS: Readonly<
  Record<DeploymentRunStatus, readonly DeploymentRunStatus[]>
> = {
  QUEUED: ["CHECKING_ELIGIBILITY", "FAILED", "CANCELLED"],
  CHECKING_ELIGIBILITY: ["PREPARING", "FAILED", "CANCELLED"],
  PREPARING: ["SIMULATING", "FAILED", "CANCELLED"],
  SIMULATING: ["PREPARED", "FAILED", "CANCELLED"],
  PREPARED: ["FUNDING", "FAILED", "CANCELLED"],
  FUNDING: ["BROADCASTING", "FAILED", "RECONCILIATION_REQUIRED"],
  BROADCASTING: ["CONFIRMING", "FAILED", "RECONCILIATION_REQUIRED"],
  CONFIRMING: ["VERIFYING", "FAILED", "RECONCILIATION_REQUIRED"],
  VERIFYING: ["COMPLETED", "FAILED", "RECONCILIATION_REQUIRED"],
  COMPLETED: [],
  FAILED: [],
  RECONCILIATION_REQUIRED: ["CONFIRMING", "VERIFYING", "COMPLETED", "FAILED"],
  CANCELLED: [],
};

export const BROADCAST_BOUNDARY_STATUSES: readonly DeploymentRunStatus[] = [
  "FUNDING",
  "BROADCASTING",
  "CONFIRMING",
  "VERIFYING",
  "COMPLETED",
  "RECONCILIATION_REQUIRED",
];

export class InvalidDeploymentTransitionError extends DomainValidationError {
  public constructor(
    public readonly fromStatus: DeploymentRunStatus,
    public readonly toStatus: DeploymentRunStatus,
  ) {
    super(`invalid deployment transition ${fromStatus} → ${toStatus}`);
    this.name = "InvalidDeploymentTransitionError";
  }
}

export function isDeploymentTransitionAllowed(
  fromStatus: DeploymentRunStatus,
  toStatus: DeploymentRunStatus,
): boolean {
  return ALLOWED_DEPLOYMENT_TRANSITIONS[fromStatus].includes(toStatus);
}

export function assertDeploymentTransition(
  fromStatus: DeploymentRunStatus,
  toStatus: DeploymentRunStatus,
): void {
  if (!isDeploymentRunStatus(fromStatus) || !isDeploymentRunStatus(toStatus)) {
    throw new DomainValidationError("deployment status is invalid");
  }
  if (!isDeploymentTransitionAllowed(fromStatus, toStatus)) {
    throw new InvalidDeploymentTransitionError(fromStatus, toStatus);
  }
}

export function hasBroadcastSideEffect(status: DeploymentRunStatus): boolean {
  return (
    status === "BROADCASTING" ||
    status === "CONFIRMING" ||
    status === "VERIFYING" ||
    status === "COMPLETED" ||
    status === "RECONCILIATION_REQUIRED"
  );
}

export function buildDeploymentPrepareKey(input: {
  repositoryRevisionId: string;
  revisionContentHash: string;
  targetTestnetKey: string;
  deploymentProfileVersion: string;
  deploymentEngineVersion: string;
  deploymentCandidateId: string;
}): string {
  return [
    "deployment",
    input.repositoryRevisionId,
    input.revisionContentHash.toLowerCase(),
    input.targetTestnetKey,
    input.deploymentProfileVersion,
    input.deploymentEngineVersion,
    input.deploymentCandidateId,
  ].join(":");
}
