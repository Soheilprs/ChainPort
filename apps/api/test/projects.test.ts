import { afterEach, describe, expect, it, vi } from "vitest";

import type { MigrationJob, Project, Repository } from "@chainport/shared";

import { createApiApplication } from "../src/app.js";
import { createLogger } from "../src/logger.js";
import { ProjectsService } from "../src/projects-service.js";

const applications: Array<Awaited<ReturnType<typeof createApiApplication>>> = [];

afterEach(async () => {
  await Promise.all(applications.splice(0).map((app) => app.close()));
});

function entities() {
  const now = new Date("2026-08-19T12:00:00.000Z");
  const repository: Repository = {
    id: "11111111-1111-4111-8111-111111111111",
    provider: "GITHUB",
    owner: "acme",
    name: "wallet",
    normalizedUrl: "https://github.com/acme/wallet",
    defaultBranch: null,
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
    dataClassification: "PRODUCTION",
    networkPartnerId: null,
    acquisitionSource: "GENERIC_PORTAL",
    referralCode: null,
    campaign: null,
    activeRevisionId: null,
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

describe("project ingest routes", () => {
  it("rejects invalid and unsafe repository URLs", async () => {
    const data = entities();
    const service = new ProjectsService(
      {
        upsertRepository: vi.fn(),
      } as never,
      {
        enqueueIngest: vi.fn(),
        enqueueAnalysis: vi.fn(),
        enqueueGenerateChangeSet: vi.fn(),
        enqueueFinalizeChangeSet: vi.fn(),
        enqueueValidate: vi.fn(),
        close: () => Promise.resolve(),
      },
    );
    const app = await createApiApplication({
      logger: createLogger({ service: "api", level: "silent" }),
      readinessProbe: () => Promise.resolve(),
      webOrigin: "http://localhost:3000",
      projectsService: service,
    });
    applications.push(app);

    const invalid = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        repositoryUrl: "https://user:token@github.com/acme/wallet",
        sourceChainKey: "ethereum",
        targetChainKey: "base",
      },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({ code: "INVALID_REPOSITORY_URL" });
    expect(data.job.status).toBe("QUEUED");
  });

  it("rejects unknown chains and identical source/target", async () => {
    const service = new ProjectsService({ upsertRepository: vi.fn() } as never, {
      enqueueIngest: vi.fn(),
      enqueueAnalysis: vi.fn(),
      enqueueGenerateChangeSet: vi.fn(),
      enqueueFinalizeChangeSet: vi.fn(),
      enqueueValidate: vi.fn(),
      close: () => Promise.resolve(),
    });
    const app = await createApiApplication({
      logger: createLogger({ service: "api", level: "silent" }),
      readinessProbe: () => Promise.resolve(),
      webOrigin: "http://localhost:3000",
      projectsService: service,
    });
    applications.push(app);

    const unknown = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        repositoryUrl: "https://github.com/acme/wallet",
        sourceChainKey: "not-a-chain",
        targetChainKey: "base",
      },
    });
    expect(unknown.statusCode).toBe(400);
    expect(unknown.json()).toMatchObject({ code: "UNKNOWN_CHAIN" });

    const same = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        repositoryUrl: "https://github.com/acme/wallet",
        sourceChainKey: "ethereum",
        targetChainKey: "ethereum",
      },
    });
    expect(same.statusCode).toBe(400);
    expect(same.json()).toMatchObject({ code: "SOURCE_TARGET_SAME" });
  });
});
