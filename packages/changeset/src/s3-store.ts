import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createId } from "@chainport/shared";

import type { RevisionArtifactStore } from "./artifacts.js";
import { listRepositoryFiles } from "./hash.js";
import { isInsideRoot, resolveContained } from "./paths.js";

export interface ObjectStoreTransport {
  put(key: string, body: Uint8Array): Promise<void>;
  head(key: string): Promise<boolean>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

export class MemoryObjectStore implements ObjectStoreTransport {
  private readonly objects = new Map<string, Uint8Array>();

  public put(key: string, body: Uint8Array): Promise<void> {
    this.objects.set(key, body);
    return Promise.resolve();
  }

  public head(key: string): Promise<boolean> {
    return Promise.resolve(this.objects.has(key));
  }

  public get(key: string): Promise<Uint8Array | null> {
    return Promise.resolve(this.objects.get(key) ?? null);
  }

  public delete(key: string): Promise<void> {
    this.objects.delete(key);
    return Promise.resolve();
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class S3CompatibleArtifactStore implements RevisionArtifactStore {
  public constructor(
    private readonly bucket: string,
    private readonly transport: ObjectStoreTransport,
  ) {}

  public root(): string {
    return `s3://${this.bucket}`;
  }

  public revisionDir(revisionId: string): string {
    if (!UUID.test(revisionId)) {
      throw new Error("revision id must be a UUID");
    }
    return `revisions/${revisionId}`;
  }

  public async exists(revisionId: string): Promise<boolean> {
    return this.transport.head(`${this.revisionDir(revisionId)}/.complete`);
  }

  public async writeTree(revisionId: string, files: ReadonlyMap<string, string>): Promise<string> {
    const prefix = this.revisionDir(revisionId);
    for (const [relative, content] of files) {
      const posix = relative.split(path.sep).join("/");
      if (posix.split("/").some((part) => part === ".." || part === "" || part === ".git")) {
        continue;
      }
      await this.transport.put(`${prefix}/${posix}`, Buffer.from(content, "utf8"));
    }
    await this.transport.put(`${prefix}/.complete`, Buffer.from("ok"));
    return `${this.root()}/${prefix}`;
  }

  public async snapshotFrom(revisionId: string, sourceRoot: string): Promise<string> {
    const files = await listRepositoryFiles(sourceRoot);
    const tree = new Map<string, string>();
    for (const relative of files) {
      const from = resolveContained(sourceRoot, relative);
      if (from === null) {
        continue;
      }
      tree.set(relative, await readFile(from, "utf8"));
    }
    return this.writeTree(revisionId, tree);
  }

  public async materialize(revisionId: string): Promise<string | null> {
    if (!(await this.exists(revisionId))) {
      return null;
    }
    const dir = await mkdtemp(path.join(tmpdir(), "chainport-s3-"));
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const prefix = this.revisionDir(revisionId);
    const complete = await this.transport.get(`${prefix}/.complete`);
    if (complete === null) {
      return null;
    }
    await writeFile(path.join(dir, ".complete"), complete);
    return dir;
  }

  public async delete(revisionId: string): Promise<void> {
    await this.transport.delete(`${this.revisionDir(revisionId)}/.complete`);
  }
}

export async function removeMaterialized(dir: string): Promise<void> {
  if (!isInsideRoot(tmpdir(), dir) && !dir.includes("chainport-s3-")) {
    return;
  }
  await rm(dir, { recursive: true, force: true });
}

export function newOpaqueRevisionKey(): string {
  return createId();
}
