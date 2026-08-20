import path from "node:path";

import {
  githubHttpsCloneUrl,
  parseGitHubRepositoryUrl,
  type GitHubRepositoryRef,
} from "@chainport/shared";

import { classifyGitFailure, runGit } from "./git.js";
import { IngestError } from "./errors.js";
import type { GitHubMetadataClient } from "./github-metadata.js";
import { directorySizeBytes, type Workspace } from "./workspace.js";

const SHA_PATTERN = /^[0-9a-f]{40}$/;

export interface CloneLimits {
  timeoutMs: number;
  maxBytes: number;
}

export interface CloneCredential {
  authorizationHeader: string;
}

export interface CloneSource {
  kind: "github" | "fixture";
  ref?: GitHubRepositoryRef;
  fixturePath?: string;
}

export interface CloneResult {
  commitSha: string;
  defaultBranch: string | null;
  sizeBytes: number;
  durationMs: number;
}

function resolveGithubRef(source: CloneSource): GitHubRepositoryRef {
  if (source.kind !== "github" || source.ref === undefined) {
    throw new IngestError("INVALID_REPOSITORY_URL");
  }
  return source.ref;
}

export async function cloneIntoWorkspace(input: {
  source: CloneSource;
  workspace: Workspace;
  limits: CloneLimits;
  metadata?: GitHubMetadataClient;
  credential?: CloneCredential;
}): Promise<CloneResult> {
  const started = Date.now();
  const destination = path.join(input.workspace.root, "repo");
  let defaultBranch: string | null = null;
  let remote: string;

  if (input.source.kind === "github") {
    const ref = resolveGithubRef(input.source);
    parseGitHubRepositoryUrl(ref.url);
    remote = githubHttpsCloneUrl(ref);
    if (input.metadata !== undefined) {
      const meta = await input.metadata.lookup(ref);
      if (meta.sizeKilobytes * 1024 > input.limits.maxBytes) {
        throw new IngestError("REPOSITORY_TOO_LARGE");
      }
      defaultBranch = meta.defaultBranch;
    }
  } else {
    if (input.source.fixturePath === undefined) {
      throw new IngestError("INVALID_REPOSITORY_URL");
    }
    if (input.source.fixturePath.includes("://")) {
      throw new IngestError("INVALID_REPOSITORY_URL");
    }
    remote = input.source.fixturePath;
  }

  const cloneArgs = ["clone", "--depth", "1", "--single-branch", "--no-tags", "--"];
  if (defaultBranch !== null) {
    cloneArgs.splice(1, 0, "--branch", defaultBranch);
  }
  cloneArgs.push(remote, destination);

  const extraConfig =
    input.credential === undefined
      ? []
      : ([
          "-c",
          `http.extraHeader=Authorization: ${input.credential.authorizationHeader}`,
        ] as const);
  const clone = await runGit(cloneArgs, {
    timeoutMs: input.limits.timeoutMs,
    extraConfig: [...extraConfig],
    ...(input.source.kind === "fixture" ? { allowLocalPath: true } : {}),
  });
  if (clone.code !== 0) {
    throw classifyGitFailure(clone.stderr);
  }

  const shaResult = await runGit(["-C", destination, "rev-parse", "HEAD"], {
    timeoutMs: Math.min(5_000, input.limits.timeoutMs),
  });
  if (shaResult.code !== 0) {
    throw new IngestError("CLONE_FAILED");
  }
  const commitSha = shaResult.stdout.trim().toLowerCase();
  if (!SHA_PATTERN.test(commitSha)) {
    throw new IngestError("CLONE_FAILED", "resolved revision is not a commit SHA");
  }

  const sizeBytes = await directorySizeBytes(destination);
  if (sizeBytes > input.limits.maxBytes) {
    throw new IngestError("REPOSITORY_TOO_LARGE");
  }

  return {
    commitSha,
    defaultBranch,
    sizeBytes,
    durationMs: Date.now() - started,
  };
}
