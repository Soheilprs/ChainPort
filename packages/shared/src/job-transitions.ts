import { DomainValidationError } from "./errors.js";
import {
  isJobStatus,
  JOB_STAGE_SEQUENCE,
  type JobStageStatus,
  type JobStatus,
  type TerminalJobStatus,
} from "./enums.js";

export const ALLOWED_JOB_TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  QUEUED: ["INGESTING", "FAILED", "CANCELLED"],
  INGESTING: ["COMPLETED", "ANALYZING", "FAILED", "CANCELLED"],
  ANALYZING: ["COMPARING", "FAILED", "CANCELLED"],
  COMPARING: ["PLANNING", "FAILED", "CANCELLED"],
  PLANNING: ["PATCHING", "COMPLETED", "FAILED", "CANCELLED"],
  PATCHING: ["BUILDING", "FAILED", "CANCELLED"],
  BUILDING: ["TESTING", "FAILED", "CANCELLED"],
  TESTING: ["DEPLOYING", "COMPLETED", "FAILED", "CANCELLED"],
  DEPLOYING: ["VERIFYING", "FAILED", "CANCELLED"],
  VERIFYING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: ["QUEUED"],
  CANCELLED: [],
};

export class InvalidJobTransitionError extends DomainValidationError {
  public constructor(
    public readonly fromStatus: JobStatus,
    public readonly toStatus: JobStatus,
  ) {
    super(`invalid job transition ${fromStatus} → ${toStatus}`);
    this.name = "InvalidJobTransitionError";
  }
}

export function isJobTransitionAllowed(fromStatus: JobStatus, toStatus: JobStatus): boolean {
  return ALLOWED_JOB_TRANSITIONS[fromStatus].includes(toStatus);
}

export function assertJobTransition(fromStatus: JobStatus, toStatus: JobStatus): void {
  if (!isJobStatus(fromStatus) || !isJobStatus(toStatus)) {
    throw new DomainValidationError("status is invalid");
  }
  if (!isJobTransitionAllowed(fromStatus, toStatus)) {
    throw new InvalidJobTransitionError(fromStatus, toStatus);
  }
}

export function nextJobStage(status: JobStageStatus): JobStageStatus | TerminalJobStatus {
  const index = JOB_STAGE_SEQUENCE.indexOf(status);
  const next = JOB_STAGE_SEQUENCE[index + 1];
  return next === undefined ? "COMPLETED" : next;
}

export function executableStageIndex(status: JobStatus): number {
  if (status === "QUEUED") {
    return 0;
  }
  const index = JOB_STAGE_SEQUENCE.indexOf(status as JobStageStatus);
  if (index === -1) {
    throw new DomainValidationError(`job status ${status} is not executable`);
  }
  return index;
}

export function canRetryJob(status: JobStatus, attempt: number, maxAttempts: number): boolean {
  return status === "FAILED" && attempt < maxAttempts;
}

export function buildJobIdempotencyKey(input: {
  projectId: string;
  sourceChainKey: string;
  targetChainKey: string;
  repoSha: string;
}): string {
  return `${input.projectId}:${input.sourceChainKey}:${input.targetChainKey}:${input.repoSha}`;
}

export function buildIngestIdempotencyKey(input: {
  owner: string;
  repo: string;
  sourceChainKey: string;
  targetChainKey: string;
}): string {
  return `github:${input.owner.toLowerCase()}:${input.repo.toLowerCase()}:${input.sourceChainKey}:${input.targetChainKey}`;
}
