import { mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { FileSystemArtifactStore, hashRepositoryTree, resolveContained } from "../src/index.js";

describe("changeset security", () => {
  it("rejects path traversal in contained file resolution", () => {
    expect(resolveContained("/tmp/repo", "../etc/passwd")).toBeNull();
    expect(resolveContained("/tmp/repo", "/etc/passwd")).toBeNull();
    expect(resolveContained("/tmp/repo", "src/config.ts")?.endsWith("src/config.ts")).toBe(true);
  });

  it("does not follow symlinks when hashing a tree", async () => {
    const root = path.join(tmpdir(), `chainport-hash-${Date.now()}`);
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(path.join(root, "src/a.ts"), "export const x = 1;\n");
    await symlink("/etc/passwd", path.join(root, "src/link"));
    const hash = await hashRepositoryTree(root);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    const again = await hashRepositoryTree(root);
    expect(again).toBe(hash);
  });

  it("ignores .git contents when hashing", async () => {
    const root = path.join(tmpdir(), `chainport-hash-git-${Date.now()}`);
    await mkdir(path.join(root, ".git"), { recursive: true });
    await writeFile(path.join(root, "readme.txt"), "ok\n");
    await writeFile(path.join(root, ".git/HEAD"), "ref: refs/heads/main\n");
    const hash = await hashRepositoryTree(root);
    const againRoot = path.join(tmpdir(), `chainport-hash-git-2-${Date.now()}`);
    await mkdir(againRoot, { recursive: true });
    await writeFile(path.join(againRoot, "readme.txt"), "ok\n");
    expect(await hashRepositoryTree(againRoot)).toBe(hash);
  });

  it("rejects non-UUID artifact revision ids", () => {
    const store = new FileSystemArtifactStore(path.join(tmpdir(), "chainport-artifacts-test"));
    expect(() => store.revisionDir("../escape")).toThrow(/UUID/);
  });
});
