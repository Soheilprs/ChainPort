export const INGEST_ERROR_CODES = [
  "INVALID_REPOSITORY_URL",
  "UNSUPPORTED_REPOSITORY_PROVIDER",
  "REPOSITORY_NOT_FOUND",
  "REPOSITORY_PRIVATE",
  "GITHUB_ACCESS_REVOKED",
  "CLONE_TIMEOUT",
  "REPOSITORY_TOO_LARGE",
  "CLONE_FAILED",
  "WORKSPACE_CLEANUP_FAILED",
  "SOURCE_TARGET_SAME",
  "UNKNOWN_CHAIN",
  "INVALID_REQUEST",
] as const;

export type IngestErrorCode = (typeof INGEST_ERROR_CODES)[number];

const RETRYABLE_INGEST_ERRORS = new Set<IngestErrorCode>(["CLONE_TIMEOUT", "CLONE_FAILED"]);

const DETERMINISTIC_INGEST_ERRORS = new Set<IngestErrorCode>([
  "INVALID_REPOSITORY_URL",
  "UNSUPPORTED_REPOSITORY_PROVIDER",
  "REPOSITORY_NOT_FOUND",
  "REPOSITORY_PRIVATE",
  "GITHUB_ACCESS_REVOKED",
  "REPOSITORY_TOO_LARGE",
  "SOURCE_TARGET_SAME",
  "UNKNOWN_CHAIN",
  "INVALID_REQUEST",
]);

export function isIngestErrorCode(value: unknown): value is IngestErrorCode {
  return typeof value === "string" && (INGEST_ERROR_CODES as readonly string[]).includes(value);
}

export function isRetryableIngestError(code: string | null | undefined): boolean {
  return (
    code !== undefined && code !== null && RETRYABLE_INGEST_ERRORS.has(code as IngestErrorCode)
  );
}

export function isDeterministicIngestError(code: string | null | undefined): boolean {
  return (
    code !== undefined && code !== null && DETERMINISTIC_INGEST_ERRORS.has(code as IngestErrorCode)
  );
}

export const INGEST_ERROR_MESSAGES: Record<IngestErrorCode, string> = {
  INVALID_REPOSITORY_URL: "Repository URL is invalid",
  UNSUPPORTED_REPOSITORY_PROVIDER: "Only GitHub repositories are supported",
  REPOSITORY_NOT_FOUND: "Repository was not found or is not accessible",
  REPOSITORY_PRIVATE: "Private repository requires GitHub App authorization",
  GITHUB_ACCESS_REVOKED: "GitHub App installation was revoked",
  CLONE_TIMEOUT: "Cloning the repository timed out",
  REPOSITORY_TOO_LARGE: "Repository exceeds the ingest size limit",
  CLONE_FAILED: "Cloning the repository failed",
  WORKSPACE_CLEANUP_FAILED: "Temporary workspace cleanup failed",
  SOURCE_TARGET_SAME: "Source and target chains must be different",
  UNKNOWN_CHAIN: "Unknown chain",
  INVALID_REQUEST: "Request is invalid",
};
