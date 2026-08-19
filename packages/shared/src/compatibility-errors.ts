export const COMPATIBILITY_ERROR_CODES = [
  "INVALID_REQUEST",
  "PROJECT_NOT_FOUND",
  "ANALYSIS_NOT_FOUND",
  "ANALYSIS_NOT_COMPLETE",
  "SOURCE_CHAIN_NOT_FOUND",
  "TARGET_CHAIN_NOT_FOUND",
  "TARGET_NOT_SUPPORTED",
  "EVALUATION_FAILED",
] as const;

export type CompatibilityErrorCode = (typeof COMPATIBILITY_ERROR_CODES)[number];

export const COMPATIBILITY_ERROR_MESSAGES: Record<CompatibilityErrorCode, string> = {
  INVALID_REQUEST: "Request is invalid",
  PROJECT_NOT_FOUND: "Project not found",
  ANALYSIS_NOT_FOUND: "Analysis not found",
  ANALYSIS_NOT_COMPLETE: "Repository analysis must complete before compatibility evaluation",
  SOURCE_CHAIN_NOT_FOUND: "Source chain is not in the registry",
  TARGET_CHAIN_NOT_FOUND: "Target chain is not in the registry",
  TARGET_NOT_SUPPORTED: "Selected chain is not a supported compatibility target",
  EVALUATION_FAILED: "Compatibility evaluation failed",
};
