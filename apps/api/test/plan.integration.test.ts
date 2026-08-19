import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AnalysisRepository,
  CompatibilityRepository,
  getDatabaseClient,
  IngestRepository,
  PlanRepository,
  resetIntegrationDatabase,
} from "@chainport/db";
import { buildAnalysisIdempotencyKey, INTEGRATION_TEST_DATABASE_PURPOSE } from "@chainport/shared";

import { CompatibilityService } from "../src/compatibility-service.js";
import { createApiApplication } from "../src/app.js";
import { createLogger } from "../src/logger.js";
import { PlanService } from "../src/plan-service.js";
import { ProjectsService } from "../src/projects-service.js";

const applications: Array<Awaited<ReturnType<typeof createApiApplication>>> = [];
const database = getDatabaseClient();
const ingest = new IngestRepository(database);
const analyses = new AnalysisRepository(database);
const compatibility = new CompatibilityRepository(database);
const plans = new PlanRepository(database);

beforeEach(async () => {
  expect(process.env.CHAINPORT_DB_PURPOSE).toBe(INTEGRATION_TEST_DATABASE_PURPOSE);
  await resetIntegrationDatabase(database);
});

afterEach(async () => {
  await Promise.all(applications.splice(0).map((app) => app.close()));
});

afterAll(async () => {
  await database.$disconnect();
});

async function makeApp() {
  const app = await createApiApplication({
    logger: createLogger({ service: "api", level: "silent" }),
    readinessProbe: () => Promise.resolve(),
    webOrigin: "http://localhost:3000",
    projectsService: new ProjectsService(ingest, {
      enqueueIngest: vi.fn(() => Promise.resolve()),
      enqueueAnalysis: vi.fn(() => Promise.resolve()),
      enqueueGenerateChangeSet: vi.fn(() => Promise.resolve()),
      enqueueFinalizeChangeSet: vi.fn(() => Promise.resolve()),
      close: () => Promise.resolve(),
    }),
    compatibilityService: new CompatibilityService(ingest, analyses, compatibility),
    planService: new PlanService(compatibility, plans),
  });
  applications.push(app);
  return app;
}

async function seedCompletedAnalysis() {
  const repository = await ingest.upsertRepository({
    owner: "acme",
    name: "wallet",
    normalizedUrl: "https://github.com/acme/wallet",
  });
  await ingest.markRepositoryReady({
    repositoryId: repository.id,
    defaultBranch: "main",
    resolvedCommitSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    sizeBytes: 12,
  });
  const project = await ingest.upsertProject({
    repositoryId: repository.id,
    name: "acme/wallet",
    githubUrl: repository.normalizedUrl,
    githubOwner: "acme",
    githubRepo: "wallet",
    defaultBranch: "main",
  });
  await ingest.createJob({
    projectId: project.id,
    repositoryId: repository.id,
    sourceChainKey: "base",
    targetChainKey: "optimism",
    idempotencyKey: "ingest-plan-test",
  });
  const analysis = await analyses.create({
    projectId: project.id,
    repositoryId: repository.id,
    commitSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    scannerVersion: "1",
    idempotencyKey: buildAnalysisIdempotencyKey({
      repositoryId: repository.id,
      commitSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      scannerVersion: "1",
    }),
  });
  await analyses.transition({
    analysisId: analysis.id,
    fromStatus: "QUEUED",
    toStatus: "MATERIALIZING",
    reason: "test",
  });
  await analyses.transition({
    analysisId: analysis.id,
    fromStatus: "MATERIALIZING",
    toStatus: "INVENTORYING",
    reason: "test",
  });
  await analyses.transition({
    analysisId: analysis.id,
    fromStatus: "INVENTORYING",
    toStatus: "ANALYZING",
    reason: "test",
  });
  await analyses.persistResult(analysis.id, {
    fileCount: 1,
    analyzedFileCount: 1,
    skippedFileCount: 0,
    totalAnalyzedBytes: 20,
    files: [
      {
        path: "src/Feed.sol",
        extension: ".sol",
        category: "SOLIDITY",
        sizeBytes: 20,
        analyzed: true,
        skipReason: null,
      },
    ],
    detectorRuns: [],
    components: [{ kind: "CONTRACT", name: "Feed", detail: null, filePath: "src/Feed.sol" }],
    requirements: [
      {
        category: "TOKEN",
        key: "USDC",
        requirementType: "NAMED_ADDRESS",
        detectedValue: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        normalizedValue: "USDC",
        confidence: "DETECTED",
        detector: "addresses",
        detectorVersion: "1",
        evidence: [
          {
            filePath: "src/Feed.sol",
            startLine: 8,
            endLine: 8,
            evidenceType: "address",
            excerpt: "USDC",
          },
        ],
      },
      {
        category: "NETWORK",
        key: "HARDCODED_CHAIN_ID",
        requirementType: "CHAIN_ID",
        detectedValue: "8453",
        normalizedValue: "base",
        confidence: "DETECTED",
        detector: "chain-id",
        detectorVersion: "1",
        evidence: [
          {
            filePath: "hardhat.config.ts",
            startLine: 1,
            endLine: 1,
            evidenceType: "chainId",
            excerpt: "chainId: 8453",
          },
        ],
      },
    ],
  });
  await analyses.transition({
    analysisId: analysis.id,
    fromStatus: "ANALYZING",
    toStatus: "COMPLETED",
    reason: "test",
  });
  return { project, analysis };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readData(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    return null;
  }
  return payload.data;
}

describe("migration plan API", () => {
  it("plans from a completed compatibility run, is idempotent, and rejects incomplete runs", async () => {
    const { project, analysis } = await seedCompletedAnalysis();
    const app = await makeApp();
    const compat = await app.inject({
      method: "POST",
      url: `/v1/projects/${project.id}/compatibility-runs`,
      payload: { analysisId: analysis.id, targetChainKey: "optimism" },
    });
    expect(compat.statusCode).toBe(201);
    const runId = String(readData(compat.json())?.id);

    const first = await app.inject({
      method: "POST",
      url: `/v1/compatibility-runs/${runId}/migration-plans`,
    });
    expect(first.statusCode).toBe(201);
    const planId = String(readData(first.json())?.id);
    expect(Number(readData(first.json())?.totalActions)).toBeGreaterThan(0);

    const details = await app.inject({ method: "GET", url: `/v1/migration-plans/${planId}` });
    expect(details.statusCode).toBe(200);
    const body = readData(details.json());
    expect(isRecord(body?.plan) ? body.plan.registrySnapshotHash : "").toBe(
      String(readData(compat.json())?.registrySnapshotHash),
    );

    const second = await app.inject({
      method: "POST",
      url: `/v1/compatibility-runs/${runId}/migration-plans`,
    });
    expect(second.statusCode).toBe(200);
    expect(readData(second.json())?.id).toBe(planId);

    const emerging = await app.inject({
      method: "POST",
      url: `/v1/projects/${project.id}/compatibility-runs`,
      payload: { analysisId: analysis.id, targetChainKey: "unichain" },
    });
    const emergingRun = String(readData(emerging.json())?.id);
    const emergingPlan = await app.inject({
      method: "POST",
      url: `/v1/compatibility-runs/${emergingRun}/migration-plans`,
    });
    expect(emergingPlan.statusCode).toBe(201);
    expect(readData(emergingPlan.json())?.id).not.toBe(planId);
    expect(readData(emergingPlan.json())?.outcome).toBe("NEEDS_VERIFICATION");
    expect(Number(readData(emergingPlan.json())?.blockedActionCount)).toBe(0);

    const incomplete = await analyses.create({
      projectId: project.id,
      repositoryId: analysis.repositoryId,
      commitSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      scannerVersion: "1",
      idempotencyKey: "other-analysis",
    });
    const queuedCompat = await app.inject({
      method: "POST",
      url: `/v1/compatibility-runs/00000000-0000-4000-8000-000000000000/migration-plans`,
    });
    expect(queuedCompat.statusCode).toBe(404);
    expect(incomplete.status).toBe("QUEUED");
  });
});
