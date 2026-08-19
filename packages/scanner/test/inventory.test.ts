import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { inventoryRepository } from "../src/index.js";

describe("inventoryRepository", () => {
  it("skips binaries, oversize files, and symlinks", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "chainport-inv-"));
    await writeFile(path.join(root, "ok.ts"), "export const x = 1;\n");
    await writeFile(path.join(root, "blob.bin"), Buffer.from([0, 1, 2, 0, 9]));
    await writeFile(path.join(root, "huge.txt"), "a".repeat(2000));
    await symlink("/etc/passwd", path.join(root, "escape"));
    const files = await inventoryRepository(root, {
      maxFiles: 50,
      maxFileBytes: 500,
      maxTotalBytes: 10_000,
      maxDepth: 5,
    });
    expect(files.some((file) => file.path === "ok.ts" && file.analyzed)).toBe(true);
    expect(files.find((file) => file.path === "blob.bin")?.skipReason).toBe("binary");
    expect(files.find((file) => file.path === "huge.txt")?.skipReason).toBe("file_too_large");
    expect(files.find((file) => file.path === "escape")?.skipReason).toBe("symlink");
  });
});
