import { access, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { cloneIntoWorkspace, WorkspaceManager } from "../src/index.js";
import { createGitFixture } from "./helpers/git-fixture.js";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    if (cleanup !== undefined) {
      await cleanup();
    }
  }
});

describe("fixture clone", () => {
  it("clones a local repository, resolves SHA, and does not execute hooks", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "chainport-fixture-"));
    const fixture = await createGitFixture(root);
    const manager = new WorkspaceManager(path.join(root, "workspaces"));
    const workspace = await manager.allocate();
    cleanups.push(async () => manager.cleanup(workspace));

    const result = await cloneIntoWorkspace({
      source: { kind: "fixture", fixturePath: fixture.repoPath },
      workspace,
      limits: { timeoutMs: 20_000, maxBytes: 10_000_000 },
    });

    expect(result.commitSha).toBe(fixture.sha);
    expect(result.sizeBytes).toBeGreaterThan(0);
    await expect(access(path.join(workspace.root, "repo", "hook-output.txt"))).rejects.toThrow();
    await expect(access(path.join(workspace.root, "repo", "README.md"))).resolves.toBeUndefined();
  });

  it("rejects an oversize clone", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "chainport-fixture-"));
    const fixture = await createGitFixture(root);
    const manager = new WorkspaceManager(path.join(root, "workspaces"));
    const workspace = await manager.allocate();
    cleanups.push(async () => manager.cleanup(workspace));

    await expect(
      cloneIntoWorkspace({
        source: { kind: "fixture", fixturePath: fixture.repoPath },
        workspace,
        limits: { timeoutMs: 20_000, maxBytes: 10 },
      }),
    ).rejects.toMatchObject({ code: "REPOSITORY_TOO_LARGE" });
  });
});
