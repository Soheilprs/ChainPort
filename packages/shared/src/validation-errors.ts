export const VALIDATION_ERROR_CODES = [
  "INVALID_REQUEST",
  "REVISION_NOT_FOUND",
  "REVISION_ARTIFACT_MISSING",
  "REVISION_INTEGRITY_MISMATCH",
  "UNSUPPORTED_FRAMEWORK",
  "UNSUPPORTED_RUNTIME_VERSION",
  "UNSUPPORTED_FOUNDRY_VERSION",
  "DEPENDENCY_RESOLUTION_FAILED",
  "INSTALL_SCRIPTS_REQUIRED",
  "INSTALL_FAILED",
  "BUILD_FAILED",
  "TEST_FAILED",
  "NETWORK_REQUIRED",
  "UNSUPPORTED_TEST_REQUIREMENT",
  "SANDBOX_START_FAILED",
  "SANDBOX_POLICY_VIOLATION",
  "EXECUTION_TIMEOUT",
  "RESOURCE_LIMIT_EXCEEDED",
  "LOG_LIMIT_EXCEEDED",
  "CLEANUP_FAILED",
  "VALIDATION_NOT_FOUND",
  "VALIDATION_NOT_ELIGIBLE",
  "VALIDATION_FAILED",
] as const;

export type ValidationErrorCode = (typeof VALIDATION_ERROR_CODES)[number];

export const VALIDATION_ERROR_MESSAGES: Record<ValidationErrorCode, string> = {
  INVALID_REQUEST: "Request is invalid",
  REVISION_NOT_FOUND: "Repository revision not found",
  REVISION_ARTIFACT_MISSING: "Generated revision artifact is missing",
  REVISION_INTEGRITY_MISMATCH: "Revision content hash did not match the persisted hash",
  UNSUPPORTED_FRAMEWORK: "No supported Foundry or Hardhat workspace was detected",
  UNSUPPORTED_RUNTIME_VERSION: "Requested Node.js version is not in the approved sandbox matrix",
  UNSUPPORTED_FOUNDRY_VERSION: "Requested Foundry version is not available in approved images",
  DEPENDENCY_RESOLUTION_FAILED: "Dependencies could not be resolved under sandbox policy",
  INSTALL_SCRIPTS_REQUIRED: "Package lifecycle scripts are required and are not executed in v1",
  INSTALL_FAILED: "Dependency installation failed",
  BUILD_FAILED: "Repository build failed",
  TEST_FAILED: "Repository tests failed",
  NETWORK_REQUIRED: "Validation requires external network access that is not granted",
  UNSUPPORTED_TEST_REQUIREMENT: "Tests require Docker or another capability the sandbox refuses",
  SANDBOX_START_FAILED: "The isolated sandbox could not be started",
  SANDBOX_POLICY_VIOLATION: "Sandbox policy would have been violated",
  EXECUTION_TIMEOUT: "Validation exceeded the configured timeout",
  RESOURCE_LIMIT_EXCEEDED: "Sandbox resource limits were exceeded",
  LOG_LIMIT_EXCEEDED: "Captured logs exceeded the configured bound",
  CLEANUP_FAILED: "Sandbox cleanup failed",
  VALIDATION_NOT_FOUND: "Validation run not found",
  VALIDATION_NOT_ELIGIBLE: "Validation run is not in a state that allows this operation",
  VALIDATION_FAILED: "Validation failed",
};

const RETRYABLE: ReadonlySet<ValidationErrorCode> = new Set([
  "SANDBOX_START_FAILED",
  "CLEANUP_FAILED",
  "VALIDATION_FAILED",
]);

export function isRetryableValidationError(code: string): boolean {
  return RETRYABLE.has(code as ValidationErrorCode);
}

const REPOSITORY_FAILURES: ReadonlySet<string> = new Set([
  "BUILD_FAILED",
  "TEST_FAILED",
  "INSTALL_FAILED",
  "INSTALL_SCRIPTS_REQUIRED",
  "DEPENDENCY_RESOLUTION_FAILED",
  "UNSUPPORTED_FRAMEWORK",
  "UNSUPPORTED_RUNTIME_VERSION",
  "UNSUPPORTED_FOUNDRY_VERSION",
  "UNSUPPORTED_TEST_REQUIREMENT",
  "NETWORK_REQUIRED",
  "REVISION_INTEGRITY_MISMATCH",
  "REVISION_ARTIFACT_MISSING",
]);

export function isRepositoryValidationFailure(code: string): boolean {
  return REPOSITORY_FAILURES.has(code);
}
