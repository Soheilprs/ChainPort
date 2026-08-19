import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { INTEGRATION_TEST_DATABASE_PURPOSE } from "@chainport/shared";

import {
  disconnectDatabase,
  getDatabaseClient,
  IngestRepository,
  resetIntegrationDatabase,
} from "../src/index.js";

describe("ingest persistence", () => {
  const database = getDatabaseClient();
  const ingest = new IngestRepository(database);

  beforeEach(async () => {
    expect(process.env.CHAINPORT_DB_PURPOSE).toBe(INTEGRATION_TEST_DATABASE_PURPOSE);
    await resetIntegrationDatabase(database);
  });

  afterAll(async () => {
    await disconnectDatabase(database);
  });

  it("creates a repository, project, job, and audit event", async () => {
    const repository = await ingest.upsertRepository({
      owner: "acme",
      name: "wallet",
      normalizedUrl: "https://github.com/acme/wallet",
    });
    const project = await ingest.upsertProject({
      repositoryId: repository.id,
      name: "acme/wallet",
      githubUrl: repository.normalizedUrl,
      githubOwner: "acme",
      githubRepo: "wallet",
      defaultBranch: "main",
    });
    const job = await ingest.createJob({
      projectId: project.id,
      repositoryId: repository.id,
      sourceChainKey: "ethereum",
      targetChainKey: "base",
      idempotencyKey: "github:acme:wallet:ethereum:base",
    });
    expect(job.status).toBe("QUEUED");
    const events = await ingest.listStatusEvents(job.id);
    expect(events.map((event) => event.toStatus)).toEqual(["QUEUED"]);
  });

  it("returns the existing job for a duplicate idempotency key", async () => {
    const repository = await ingest.upsertRepository({
      owner: "acme",
      name: "wallet",
      normalizedUrl: "https://github.com/acme/wallet",
    });
    const project = await ingest.upsertProject({
      repositoryId: repository.id,
      name: "acme/wallet",
      githubUrl: repository.normalizedUrl,
      githubOwner: "acme",
      githubRepo: "wallet",
      defaultBranch: "main",
    });
    const first = await ingest.createJob({
      projectId: project.id,
      repositoryId: repository.id,
      sourceChainKey: "ethereum",
      targetChainKey: "base",
      idempotencyKey: "github:acme:wallet:ethereum:base",
    });
    const second = await ingest.findJobByIdempotencyKey("github:acme:wallet:ethereum:base");
    expect(second?.id).toBe(first.id);
  });

  it("records ingest state transitions", async () => {
    const repository = await ingest.upsertRepository({
      owner: "acme",
      name: "wallet",
      normalizedUrl: "https://github.com/acme/wallet",
    });
    const project = await ingest.upsertProject({
      repositoryId: repository.id,
      name: "acme/wallet",
      githubUrl: repository.normalizedUrl,
      githubOwner: "acme",
      githubRepo: "wallet",
      defaultBranch: "main",
    });
    const job = await ingest.createJob({
      projectId: project.id,
      repositoryId: repository.id,
      sourceChainKey: "ethereum",
      targetChainKey: "base",
      idempotencyKey: "github:acme:wallet:ethereum:base",
    });
    await ingest.transitionJob({
      jobId: job.id,
      fromStatus: "QUEUED",
      toStatus: "INGESTING",
      reason: "clone started",
    });
    const completed = await ingest.transitionJob({
      jobId: job.id,
      fromStatus: "INGESTING",
      toStatus: "COMPLETED",
      reason: "repository ready",
      repoSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.repoSha).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    const events = await ingest.listStatusEvents(job.id);
    expect(events.map((event) => event.toStatus)).toEqual(["QUEUED", "INGESTING", "COMPLETED"]);
  });
});
