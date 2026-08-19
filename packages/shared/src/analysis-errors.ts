export const ANALYSIS_ERROR_CODES = [
  "INGEST_NOT_COMPLETE",
  "SHA_MISSING",
  "SHA_MISMATCH",
  "MATERIALIZE_FAILED",
  "ANALYSIS_TIMEOUT",
  "PATH_ESCAPE",
  "ANALYSIS_FAILED",
  "INVALID_REQUEST",
] as const;

export type AnalysisErrorCode = (typeof ANALYSIS_ERROR_CODES)[number];

export function isRetryableAnalysisError(code: string | null | undefined): boolean {
  return code === "MATERIALIZE_FAILED" || code === "ANALYSIS_TIMEOUT";
}

export const ANALYSIS_ERROR_MESSAGES: Record<AnalysisErrorCode, string> = {
  INGEST_NOT_COMPLETE: "Repository ingest must complete before analysis",
  SHA_MISSING: "Repository does not have a stored commit SHA",
  SHA_MISMATCH: "Materialized revision does not match the stored commit SHA",
  MATERIALIZE_FAILED: "Failed to materialize the stored revision",
  ANALYSIS_TIMEOUT: "Analysis timed out",
  PATH_ESCAPE: "Repository path escaped the workspace root",
  ANALYSIS_FAILED: "Analysis failed",
  INVALID_REQUEST: "Request is invalid",
};
