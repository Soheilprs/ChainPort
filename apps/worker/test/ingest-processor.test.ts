import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { UnrecoverableError } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import { IngestError, WorkspaceManager } from "@chainport/ingest";
import type { MigrationJob, Project, Repository } from "@chainport/shared";

import { createLogger } from "../src/logger.js";
import { processIngestJob } from "../src/ingest-processor.js";

function makeEntities() {
  const now = new Date();
  const repository: Repository = {
    id: "11111111-1111-4111-8111-111111111111",
    provider: "GITHUB",
    owner: "acme",
    name: "wallet",
    normalizedUrl: "https://github.com/acme/wallet",
    defaultBranch: "main",
    resolvedCommitSha: null,
    cloneStatus: "PENDING",
    clonedAt: null,
    sizeBytes: null,
    ingestErrorCode: null,
    ingestErrorMessage: null,
    createdAt: now,
    updatedAt: now,
  };
  const project: Project = {
    id: "22222222-2222-4222-8222-222222222222",
    organizationId: null,
    repositoryId: repository.id,
    name: "acme/wallet",
    githubUrl: repository.normalizedUrl,
    githubOwner: "acme",
    githubRepo: "wallet",
    defaultBranch: "main",
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };
  const job: MigrationJob = {
    id: "33333333-3333-4333-8333-333333333333",
    projectId: project.id,
    repositoryId: repository.id,
    sourceChainKey: "ethereum",
    targetChainKey: "base",
    repoSha: null,
    status: "QUEUED",
    attempt: 0,
    maxAttempts: 3,
    idempotencyKey: "github:acme:wallet:ethereum:base",
    leaseOwner: null,
    leaseExpiresAt: null,
    errorCode: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  return { repository, project, job };
}

describe("processIngestJob", () => {
  it("clones, stores the SHA, and completes without analyzing", async () => {
    const entities = makeEntities();
    const transitions: string[] = [];
    const ingest = {
      getBundleByJobId: vi.fn(() => Promise.resolve(entities)),
      getJobById: vi.fn(() => Promise.resolve(entities.job)),
      transitionJob: vi.fn((input: { toStatus: string }) => {
        transitions.push(input.toStatus);
        entities.job = { ...entities.job, status: input.toStatus as typeof entities.job.status };
        return Promise.resolve(entities.job);
      }),
      markRepositoryCloning: vi.fn(() => Promise.resolve(entities.repository)),
      markRepositoryReady: vi.fn(() => Promise.resolve(entities.repository)),
      markRepositoryFailed: vi.fn(() => Promise.resolve(entities.repository)),
    };
    const root = await mkdtemp(path.join(tmpdir(), "chainport-processor-"));
    await processIngestJob(entities.job.id, {
      ingest: ingest as never,
      workspaces: new WorkspaceManager(root),
      metadata: {
        lookup: () => Promise.resolve({ defaultBranch: "main", sizeKilobytes: 1, private: false }),
      },
      config: { CLONE_TIMEOUT_MS: 5_000, CLONE_MAX_BYTES: 1_000_000 },
      logger: createLogger({ service: "worker", level: "silent" }),
      workerId: "worker-1",
      clone: () =>
        Promise.resolve({
          commitSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          defaultBranch: "main",
          sizeBytes: 128,
          durationMs: 12,
        }),
    });

    expect(transitions).toEqual(["INGESTING", "COMPLETED"]);
    expect(ingest.markRepositoryReady).toHaveBeenCalledOnce();
  });

  it("does not retry deterministic not-found failures", async () => {
    const entities = makeEntities();
    const ingest = {
      getBundleByJobId: vi.fn(() => Promise.resolve(entities)),
      getJobById: vi.fn(() => Promise.resolve({ ...entities.job, attempt: 1 })),
      transitionJob: vi.fn((input: { toStatus: string }) => {
        entities.job = { ...entities.job, status: input.toStatus as typeof entities.job.status };
        return Promise.resolve(entities.job);
      }),
      markRepositoryCloning: vi.fn(() => Promise.resolve(entities.repository)),
      markRepositoryReady: vi.fn(() => Promise.resolve(entities.repository)),
      markRepositoryFailed: vi.fn(() => Promise.resolve(entities.repository)),
    };
    const root = await mkdtemp(path.join(tmpdir(), "chainport-processor-"));

    await expect(
      processIngestJob(entities.job.id, {
        ingest: ingest as never,
        workspaces: new WorkspaceManager(root),
        metadata: {
          lookup: () =>
            Promise.resolve({ defaultBranch: "main", sizeKilobytes: 1, private: false }),
        },
        config: { CLONE_TIMEOUT_MS: 5_000, CLONE_MAX_BYTES: 1_000_000 },
        logger: createLogger({ service: "worker", level: "silent" }),
        workerId: "worker-1",
        clone: () => Promise.reject(new IngestError("REPOSITORY_NOT_FOUND")),
      }),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });
});
