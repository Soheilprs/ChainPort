export { IngestError } from "./errors.js";
export {
  cloneIntoWorkspace,
  type CloneCredential,
  type CloneLimits,
  type CloneResult,
  type CloneSource,
} from "./clone.js";
export { materializeRevision, type MaterializeResult } from "./materialize.js";
export { classifyGitFailure, runGit, safeGitEnv } from "./git.js";
export {
  HttpGitHubMetadataClient,
  type GitHubMetadataClient,
  type GitHubRepositoryMetadata,
} from "./github-metadata.js";
export { WorkspaceManager, directorySizeBytes, type Workspace } from "./workspace.js";
