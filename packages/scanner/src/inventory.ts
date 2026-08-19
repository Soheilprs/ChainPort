import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";

import type { FileCategory } from "@chainport/shared";

import type { InventoriedFile, ScannerLimits } from "./types.js";

const SKIP_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "cache",
  "artifacts",
  "out",
  ".next",
  "target",
  ".turbo",
  ".pnpm-store",
]);

export function categorizeFile(relativePath: string): FileCategory {
  const base = path.basename(relativePath).toLowerCase();
  const ext = path.extname(relativePath).toLowerCase();
  if (
    base === ".env" ||
    base.startsWith(".env.") ||
    base.endsWith(".env") ||
    base.includes(".env.")
  ) {
    return "ENV_TEMPLATE";
  }
  if (ext === ".sol") {
    return "SOLIDITY";
  }
  if (ext === ".ts" || ext === ".tsx") {
    return "TYPESCRIPT";
  }
  if (ext === ".js" || ext === ".jsx" || ext === ".mjs" || ext === ".cjs") {
    return "JAVASCRIPT";
  }
  if (ext === ".json") {
    return "JSON";
  }
  if (ext === ".toml") {
    return "TOML";
  }
  if (ext === ".yml" || ext === ".yaml") {
    return "YAML";
  }
  if (ext === ".md") {
    return "MARKDOWN";
  }
  if (base.includes("config") || base === "foundry.toml" || base.startsWith("hardhat.config")) {
    return "CONFIG";
  }
  return "OTHER";
}

function isBinary(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  return sample.includes(0);
}

export async function inventoryRepository(
  root: string,
  limits: ScannerLimits,
): Promise<InventoriedFile[]> {
  const resolvedRoot = await realpath(root);
  const files: InventoriedFile[] = [];
  let analyzedBytes = 0;

  async function walk(directory: string, depth: number): Promise<void> {
    if (files.length >= limits.maxFiles) {
      return;
    }
    if (depth > limits.maxDepth) {
      return;
    }
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= limits.maxFiles) {
        return;
      }
      const full = path.join(directory, entry.name);
      const relative = path.relative(resolvedRoot, full).split(path.sep).join("/");
      const stat = await lstat(full);
      if (stat.isSymbolicLink()) {
        files.push({
          path: relative,
          extension: path.extname(entry.name).toLowerCase(),
          category: categorizeFile(relative),
          sizeBytes: 0,
          analyzed: false,
          skipReason: "symlink",
        });
        continue;
      }
      if (stat.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) {
          continue;
        }
        await walk(full, depth + 1);
        continue;
      }
      if (!stat.isFile()) {
        continue;
      }
      const extension = path.extname(entry.name).toLowerCase();
      const category = categorizeFile(relative);
      if (stat.size > limits.maxFileBytes) {
        files.push({
          path: relative,
          extension,
          category,
          sizeBytes: stat.size,
          analyzed: false,
          skipReason: "file_too_large",
        });
        continue;
      }
      const buffer = await readFile(full);
      if (isBinary(buffer)) {
        files.push({
          path: relative,
          extension,
          category,
          sizeBytes: stat.size,
          analyzed: false,
          skipReason: "binary",
        });
        continue;
      }
      if (analyzedBytes + buffer.length > limits.maxTotalBytes) {
        files.push({
          path: relative,
          extension,
          category,
          sizeBytes: stat.size,
          analyzed: false,
          skipReason: "total_bytes_cap",
        });
        continue;
      }
      analyzedBytes += buffer.length;
      files.push({
        path: relative,
        extension,
        category,
        sizeBytes: stat.size,
        analyzed: true,
        skipReason: null,
        text: buffer.toString("utf8"),
      });
    }
  }

  await walk(resolvedRoot, 0);
  return files;
}

export function isSkippedPath(relativePath: string): boolean {
  return relativePath.split("/").some((segment) => SKIP_DIRECTORIES.has(segment));
}
