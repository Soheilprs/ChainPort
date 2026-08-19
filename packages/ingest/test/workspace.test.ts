import { mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { IngestError, WorkspaceManager } from "../src/index.js";

const managers: WorkspaceManager[] = [];
const workspaces: Array<{ manager: WorkspaceManager; id: string; root: string }> = [];

afterEach(async () => {
  for (const workspace of workspaces.splice(0)) {
    await workspace.manager.cleanup(workspace).catch(() => undefined);
  }
  managers.splice(0);
});

describe("WorkspaceManager", () => {
  it("allocates a unique directory under the configured root", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "chainport-ws-"));
    const manager = new WorkspaceManager(root);
    managers.push(manager);
    const workspace = await manager.allocate();
    workspaces.push({ manager, ...workspace });
    expect(workspace.root.startsWith(await realpath(root))).toBe(true);
    expect(workspace.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("rejects paths that escape the workspace root", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "chainport-ws-"));
    const manager = new WorkspaceManager(root);
    expect(() => manager.assertContained(path.join(root, "..", "etc"))).toThrow(IngestError);
  });

  it("removes the workspace on cleanup", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "chainport-ws-"));
    const manager = new WorkspaceManager(root);
    const workspace = await manager.allocate();
    await writeFile(path.join(workspace.root, "marker.txt"), "x");
    await manager.cleanup(workspace);
    await expect(manager.cleanup(workspace)).resolves.toBeUndefined();
  });
});
