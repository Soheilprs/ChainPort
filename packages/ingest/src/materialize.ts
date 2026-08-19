import path from "node:path";

import { githubHttpsCloneUrl, parseGitHubRepositoryUrl } from "@chainport/shared";

import { classifyGitFailure, runGit } from "./git.js";
import { IngestError } from "./errors.js";
import type { CloneLimits, CloneSource } from "./clone.js";
import type { Workspace } from "./workspace.js";

const SHA_PATTERN = /^[0-9a-f]{40}$/;

export interface MaterializeResult {
  repoPath: string;
  commitSha: string;
  durationMs: number;
}

export async function materializeRevision(input: {
  source: CloneSource;
  workspace: Workspace;
  commitSha: string;
  limits: CloneLimits;
}): Promise<MaterializeResult> {
  const expected = input.commitSha.toLowerCase();
  if (!SHA_PATTERN.test(expected)) {
    throw new IngestError("CLONE_FAILED", "stored revision is not a commit SHA");
  }
  const started = Date.now();
  const repoPath = path.join(input.workspace.root, "repo");
  const timeoutMs = input.limits.timeoutMs;
  const allowLocalPath = input.source.kind === "fixture";

  if (input.source.kind === "github") {
    if (input.source.ref === undefined) {
      throw new IngestError("INVALID_REPOSITORY_URL");
    }
    parseGitHubRepositoryUrl(input.source.ref.url);
    const remote = githubHttpsCloneUrl(input.source.ref);
    const init = await runGit(["init", repoPath], { timeoutMs });
    if (init.code !== 0) {
      throw classifyGitFailure(init.stderr);
    }
    const addRemote = await runGit(["-C", repoPath, "remote", "add", "origin", remote], {
      timeoutMs,
    });
    if (addRemote.code !== 0) {
      throw classifyGitFailure(addRemote.stderr);
    }
    const fetch = await runGit(["-C", repoPath, "fetch", "--depth", "1", "origin", expected], {
      timeoutMs,
    });
    if (fetch.code !== 0) {
      throw classifyGitFailure(fetch.stderr);
    }
    const checkout = await runGit(["-C", repoPath, "checkout", "--detach", "FETCH_HEAD"], {
      timeoutMs,
    });
    if (checkout.code !== 0) {
      throw classifyGitFailure(checkout.stderr);
    }
  } else {
    if (input.source.fixturePath === undefined || input.source.fixturePath.includes("://")) {
      throw new IngestError("INVALID_REPOSITORY_URL");
    }
    const clone = await runGit(["clone", "--", input.source.fixturePath, repoPath], {
      timeoutMs,
      allowLocalPath: true,
    });
    if (clone.code !== 0) {
      throw classifyGitFailure(clone.stderr);
    }
    const checkout = await runGit(["-C", repoPath, "checkout", "--detach", expected], {
      timeoutMs,
      allowLocalPath: true,
    });
    if (checkout.code !== 0) {
      throw classifyGitFailure(checkout.stderr);
    }
  }

  const shaResult = await runGit(["-C", repoPath, "rev-parse", "HEAD"], {
    timeoutMs: Math.min(5_000, timeoutMs),
    ...(allowLocalPath ? { allowLocalPath: true } : {}),
  });
  const actual = shaResult.stdout.trim().toLowerCase();
  if (!SHA_PATTERN.test(actual) || actual !== expected) {
    throw new IngestError("CLONE_FAILED", "materialized revision does not match stored SHA");
  }
  return { repoPath, commitSha: actual, durationMs: Date.now() - started };
}
