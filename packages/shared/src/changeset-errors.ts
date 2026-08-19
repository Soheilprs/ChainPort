export const CHANGESET_ERROR_CODES = [
  "INVALID_REQUEST",
  "PLAN_NOT_FOUND",
  "PLAN_NOT_COMPLETE",
  "CHANGESET_NOT_FOUND",
  "CHANGESET_NOT_ELIGIBLE",
  "CHANGE_NOT_FOUND",
  "REVISION_MISMATCH",
  "SOURCE_MISMATCH",
  "PATCHER_UNSUPPORTED",
  "PATCH_PRECONDITION_FAILED",
  "UNSAFE_ENV_FILE",
  "PATH_ESCAPE_DETECTED",
  "ARTIFACT_WRITE_FAILED",
  "FINALIZATION_FAILED",
  "CONTENT_HASH_MISMATCH",
  "CHANGESET_FAILED",
] as const;

export type ChangeSetErrorCode = (typeof CHANGESET_ERROR_CODES)[number];

export const CHANGESET_ERROR_MESSAGES: Record<ChangeSetErrorCode, string> = {
  INVALID_REQUEST: "Request is invalid",
  PLAN_NOT_FOUND: "Migration plan not found",
  PLAN_NOT_COMPLETE: "Migration plan must complete before generating safe fixes",
  CHANGESET_NOT_FOUND: "ChangeSet not found",
  CHANGESET_NOT_ELIGIBLE: "ChangeSet is not in a state that allows this operation",
  CHANGE_NOT_FOUND: "Change not found",
  REVISION_MISMATCH: "Repository SHA does not match the migration plan",
  SOURCE_MISMATCH: "File content does not match migration evidence",
  PATCHER_UNSUPPORTED: "No safe patcher supports this action and file",
  PATCH_PRECONDITION_FAILED: "A safe-patch precondition failed",
  UNSAFE_ENV_FILE: "Secret-bearing env files are not auto-patched",
  PATH_ESCAPE_DETECTED: "Patch path escaped the repository root",
  ARTIFACT_WRITE_FAILED: "Failed to write generated revision artifacts",
  FINALIZATION_FAILED: "ChangeSet finalization failed",
  CONTENT_HASH_MISMATCH: "Generated revision content hash did not match the expected hash",
  CHANGESET_FAILED: "ChangeSet generation failed",
};
