import { chmod, copyFile, mkdir, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createId } from "@chainport/shared";

import { listRepositoryFiles } from "./hash.js";
import { isInsideRoot, resolveContained } from "./paths.js";

export interface RevisionArtifactStore {
  root(): string;
  revisionDir(revisionId: string): string;
  writeTree(revisionId: string, files: ReadonlyMap<string, string>): Promise<string>;
  snapshotFrom(revisionId: string, sourceRoot: string): Promise<string>;
  materialize(revisionId: string): Promise<string | null>;
  exists(revisionId: string): Promise<boolean>;
  delete(revisionId: string): Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class FileSystemArtifactStore implements RevisionArtifactStore {
  public constructor(private readonly baseRoot: string) {}

  public static defaultRoot(): string {
    return path.join(tmpdir(), "chainport-artifacts");
  }

  public root(): string {
    return path.resolve(this.baseRoot);
  }

  public revisionDir(revisionId: string): string {
    if (!UUID.test(revisionId)) {
      throw new Error("revision id must be a UUID");
    }
    const candidate = path.join(this.root(), revisionId);
    if (!isInsideRoot(this.root(), candidate)) {
      throw new Error("artifact path escaped the configured root");
    }
    return candidate;
  }

  public async exists(revisionId: string): Promise<boolean> {
    try {
      await stat(this.revisionDir(revisionId));
      return true;
    } catch {
      return false;
    }
  }

  public async writeTree(revisionId: string, files: ReadonlyMap<string, string>): Promise<string> {
    const dir = this.revisionDir(revisionId);
    await mkdir(this.root(), { recursive: true, mode: 0o700 });
    await mkdir(dir, { recursive: true, mode: 0o700 });
    for (const [relative, content] of files) {
      const posix = relative.split(path.sep).join("/");
      if (posix.split("/").some((part) => part === ".." || part === "" || part === ".git")) {
        continue;
      }
      const target = path.join(dir, posix);
      if (!isInsideRoot(dir, target)) {
        throw new Error("artifact path escaped the configured root");
      }
      await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      await writeFile(target, content, { encoding: "utf8", mode: 0o600 });
    }
    return realpath(dir);
  }

  public async snapshotFrom(revisionId: string, sourceRoot: string): Promise<string> {
    const dir = this.revisionDir(revisionId);
    await mkdir(this.root(), { recursive: true, mode: 0o700 });
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const files = await listRepositoryFiles(sourceRoot);
    for (const relative of files) {
      const from = resolveContained(sourceRoot, relative);
      const to = resolveContained(dir, relative);
      if (from === null || to === null) {
        throw new Error("artifact path escaped the configured root");
      }
      await mkdir(path.dirname(to), { recursive: true, mode: 0o700 });
      await copyFile(from, to);
      await chmod(to, 0o600);
    }
    await assertEmptyOfGit(dir);
    return realpath(dir);
  }

  public async materialize(revisionId: string): Promise<string | null> {
    if (!(await this.exists(revisionId))) {
      return null;
    }
    return realpath(this.revisionDir(revisionId));
  }

  public async delete(revisionId: string): Promise<void> {
    const dir = this.revisionDir(revisionId);
    await rm(dir, { recursive: true, force: true });
  }
}

export async function copyTree(
  from: string,
  files: readonly string[],
): Promise<Map<string, string>> {
  const { readFile } = await import("node:fs/promises");
  const tree = new Map<string, string>();
  for (const relative of files) {
    const full = path.join(from, relative);
    tree.set(relative, await readFile(full, "utf8"));
  }
  return tree;
}

export function newArtifactId(): string {
  return createId();
}

export async function removeTempDir(directory: string, root: string): Promise<void> {
  if (!isInsideRoot(root, directory)) {
    throw new Error("workspace path escaped the configured root");
  }
  await rm(directory, { recursive: true, force: true });
  try {
    await stat(directory);
    throw new Error("workspace cleanup failed");
  } catch (error) {
    if (error instanceof Error && error.message === "workspace cleanup failed") {
      throw error;
    }
  }
}

export async function assertEmptyOfGit(directory: string): Promise<void> {
  const entries = await readdir(directory);
  if (entries.includes(".git")) {
    throw new Error("generated artifacts must not include .git");
  }
}
