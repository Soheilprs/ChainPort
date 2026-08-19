import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Content hash for a generated repository revision.
 *
 * Algorithm: SHA-256 over a concatenation of records in lexicographic UTF-8
 * relative-path order. Each record is `relativePath + NUL + fileBytes + NUL`.
 *
 * Paths use POSIX separators and are relative to the snapshot root.
 *
 * Excluded: `.git` directories, symbolic links, and non-regular files.
 * Timestamps and original Git metadata are not hashed.
 */

export function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function listRepositoryFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  await walk(root, root, files);
  files.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  return files;
}

async function walk(root: string, directory: string, files: string[]): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git") {
      continue;
    }
    const full = path.join(directory, entry.name);
    const relative = path.relative(root, full).split(path.sep).join("/");
    if (relative.startsWith("..")) {
      continue;
    }
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      await walk(root, full, files);
      continue;
    }
    if (entry.isFile()) {
      files.push(relative);
    }
  }
}

export async function hashRepositoryTree(root: string): Promise<string> {
  const files = await listRepositoryFiles(root);
  const hash = createHash("sha256");
  for (const relative of files) {
    const full = path.join(root, relative);
    const info = await lstat(full);
    if (info.isSymbolicLink() || !info.isFile()) {
      continue;
    }
    hash.update(relative);
    hash.update("\0");
    hash.update(await readFile(full));
    hash.update("\0");
  }
  return hash.digest("hex");
}
