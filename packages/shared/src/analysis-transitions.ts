import { DomainValidationError } from "./errors.js";
import { isAnalysisStatus, type AnalysisStatus } from "./enums.js";

export const ALLOWED_ANALYSIS_TRANSITIONS: Readonly<
  Record<AnalysisStatus, readonly AnalysisStatus[]>
> = {
  QUEUED: ["MATERIALIZING", "FAILED"],
  MATERIALIZING: ["INVENTORYING", "FAILED"],
  INVENTORYING: ["ANALYZING", "FAILED"],
  ANALYZING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: ["QUEUED"],
};

export class InvalidAnalysisTransitionError extends DomainValidationError {
  public constructor(
    public readonly fromStatus: AnalysisStatus,
    public readonly toStatus: AnalysisStatus,
  ) {
    super(`invalid analysis transition ${fromStatus} → ${toStatus}`);
    this.name = "InvalidAnalysisTransitionError";
  }
}

export function isAnalysisTransitionAllowed(
  fromStatus: AnalysisStatus,
  toStatus: AnalysisStatus,
): boolean {
  return ALLOWED_ANALYSIS_TRANSITIONS[fromStatus].includes(toStatus);
}

export function assertAnalysisTransition(
  fromStatus: AnalysisStatus,
  toStatus: AnalysisStatus,
): void {
  if (!isAnalysisStatus(fromStatus) || !isAnalysisStatus(toStatus)) {
    throw new DomainValidationError("analysis status is invalid");
  }
  if (!isAnalysisTransitionAllowed(fromStatus, toStatus)) {
    throw new InvalidAnalysisTransitionError(fromStatus, toStatus);
  }
}

export function buildAnalysisIdempotencyKey(input: {
  repositoryId: string;
  commitSha: string;
  scannerVersion: string;
}): string {
  return `${input.repositoryId}:${input.commitSha.toLowerCase()}:${input.scannerVersion}`;
}
