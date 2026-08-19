import { mkdir, readdir, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createId } from "@chainport/shared";

import { IngestError } from "./errors.js";

export interface Workspace {
  id: string;
  root: string;
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export class WorkspaceManager {
  public constructor(private readonly baseRoot: string) {}

  public static defaultRoot(): string {
    return path.join(tmpdir(), "chainport-workspaces");
  }

  public root(): string {
    return path.resolve(this.baseRoot);
  }

  public async resolvedRoot(): Promise<string> {
    await mkdir(this.root(), { recursive: true, mode: 0o700 });
    return realpath(this.root());
  }

  public async allocate(): Promise<Workspace> {
    const id = createId();
    const root = await this.resolvedRoot();
    const candidate = path.join(root, id);
    if (!isInside(root, candidate)) {
      throw new IngestError("CLONE_FAILED", "workspace path escaped the configured root");
    }
    await mkdir(candidate, { recursive: true, mode: 0o700 });
    const resolved = await realpath(candidate);
    if (!isInside(root, resolved)) {
      throw new IngestError("CLONE_FAILED", "workspace path escaped the configured root");
    }
    return { id, root: resolved };
  }

  public async cleanup(workspace: Workspace): Promise<void> {
    const root = await this.resolvedRoot();
    if (!isInside(root, path.resolve(workspace.root))) {
      throw new IngestError(
        "WORKSPACE_CLEANUP_FAILED",
        "workspace path escaped the configured root",
      );
    }
    try {
      await rm(workspace.root, { recursive: true, force: true });
    } catch {
      throw new IngestError("WORKSPACE_CLEANUP_FAILED");
    }
    try {
      await stat(workspace.root);
      throw new IngestError("WORKSPACE_CLEANUP_FAILED");
    } catch (error) {
      if (error instanceof IngestError) {
        throw error;
      }
    }
  }

  public assertContained(target: string): void {
    if (!isInside(this.root(), path.resolve(target))) {
      throw new IngestError("CLONE_FAILED", "workspace path escaped the configured root");
    }
  }
}

export async function directorySizeBytes(directory: string): Promise<number> {
  let total = 0;
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      total += await directorySizeBytes(full);
    } else if (entry.isFile()) {
      total += (await stat(full)).size;
    }
  }
  return total;
}
