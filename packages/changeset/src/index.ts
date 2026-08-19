export {
  FileSystemArtifactStore,
  copyTree,
  newArtifactId,
  removeTempDir,
  type RevisionArtifactStore,
} from "./artifacts.js";
export { applyPatchToWorkingText } from "./apply.js";
export { unifiedDiff } from "./diff.js";
export { generatePatch, SAFE_PATCHERS } from "./engine.js";
export { hashRepositoryTree, listRepositoryFiles, sha256Text } from "./hash.js";
export { isInsideRoot, isSafeEnvTemplate, isUnsafeEnvFile, resolveContained } from "./paths.js";
export type {
  GeneratedPatch,
  PatchContext,
  PatchEvidence,
  PatchSkip,
  PatchableAction,
  SafePatcher,
} from "./types.js";
export { isSkip } from "./types.js";
export { CHANGESET_ENGINE_VERSION } from "./version.js";
