import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AnalysisRepository,
  CompatibilityRepository,
  getDatabaseClient,
  IngestRepository,
  resetIntegrationDatabase,
} from "@chainport/db";
import { buildAnalysisIdempotencyKey, INTEGRATION_TEST_DATABASE_PURPOSE } from "@chainport/shared";

import { CompatibilityService } from "../src/compatibility-service.js";
import { createApiApplication } from "../src/app.js";
import { createLogger } from "../src/logger.js";
import { ProjectsService } from "../src/projects-service.js";

const applications: Array<Awaited<ReturnType<typeof createApiApplication>>> = [];
const database = getDatabaseClient();
const ingest = new IngestRepository(database);
const analyses = new AnalysisRepository(database);
const compatibility = new CompatibilityRepository(database);

beforeEach(async () => {
  expect(process.env.CHAINPORT_DB_PURPOSE).toBe(INTEGRATION_TEST_DATABASE_PURPOSE);
  await resetIntegrationDatabase(database);
});

afterEach(async () => {
  await PromiseAllClose();
});

afterAll(async () => {
  await database.$disconnect();
});

async function PromiseAllClose() {
  await Promise.all(applications.splice(0).map((app) => app.close()));
}

async function makeApp() {
  const app = await createApiApplication({
    logger: createLogger({ service: "api", level: "silent" }),
    readinessProbe: () => Promise.resolve(),
    webOrigin: "http://localhost:3000",
    projectsService: new ProjectsService(ingest, {
      enqueueIngest: vi.fn(() => Promise.resolve()),
      enqueueAnalysis: vi.fn(() => Promise.resolve()),
      close: () => Promise.resolve(),
    }),
    compatibilityService: new CompatibilityService(ingest, analyses, compatibility),
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
    idempotencyKey: "ingest-test",
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
            excerpt: "USDC = IERC20(0x8335…)",
          },
        ],
      },
      {
        category: "ORACLE",
        key: "CHAINLINK",
        requirementType: "PROTOCOL",
        detectedValue: "CHAINLINK",
        normalizedValue: "CHAINLINK",
        confidence: "DETECTED",
        detector: "protocols",
        detectorVersion: "1",
        evidence: [
          {
            filePath: "src/Feed.sol",
            startLine: 4,
            endLine: 4,
            evidenceType: "import",
            excerpt: "import AggregatorV3Interface",
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
      {
        category: "RPC",
        key: "RPC_METHOD",
        requirementType: "JSON_RPC",
        detectedValue: "debug_traceCall",
        normalizedValue: "debug_traceCall",
        confidence: "DETECTED",
        detector: "rpc",
        detectorVersion: "1",
        evidence: [
          {
            filePath: "src/trace.ts",
            startLine: 2,
            endLine: 2,
            evidenceType: "rpc_method",
            excerpt: '"debug_traceCall"',
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

describe("compatibility API", () => {
  it("evaluates synchronously, is idempotent, and keeps UNKNOWN distinct from BLOCKER", async () => {
    const { project, analysis } = await seedCompletedAnalysis();
    const app = await makeApp();

    const first = await app.inject({
      method: "POST",
      url: `/v1/projects/${project.id}/compatibility-runs`,
      payload: { analysisId: analysis.id, targetChainKey: "optimism" },
    });
    expect(first.statusCode).toBe(201);
    const createdId = readRunId(first.json());
    expect(readUnknownCount(first.json())).toBeGreaterThan(0);

    const report = await app.inject({
      method: "GET",
      url: `/v1/compatibility-runs/${createdId}`,
    });
    expect(report.statusCode).toBe(200);
    const findings = readFindings(report.json());
    expect(findings.some((item) => item.status === "BLOCKER")).toBe(false);
    expect(
      findings.some((item) => item.status === "UNKNOWN" && item.title.includes("debug_traceCall")),
    ).toBe(true);
    expect(findings.some((item) => item.status === "WARNING" && item.title.includes("USDC"))).toBe(
      true,
    );
    expect(readReadiness(report.json())).not.toBe("BLOCKED");

    const second = await app.inject({
      method: "POST",
      url: `/v1/projects/${project.id}/compatibility-runs`,
      payload: { analysisId: analysis.id, targetChainKey: "optimism" },
    });
    expect(second.statusCode).toBe(200);
    expect(readRunId(second.json())).toBe(createdId);

    const emerging = await app.inject({
      method: "POST",
      url: `/v1/projects/${project.id}/compatibility-runs`,
      payload: { analysisId: analysis.id, targetChainKey: "unichain" },
    });
    expect(emerging.statusCode).toBe(201);
    const emergingId = readRunId(emerging.json());
    expect(emergingId).not.toBe(createdId);
    const emergingReport = await app.inject({
      method: "GET",
      url: `/v1/compatibility-runs/${emergingId}`,
    });
    expect(readBlockerCount(emergingReport.json())).toBe(0);
    expect(
      readFindings(emergingReport.json()).some(
        (item) => item.title.includes("Chainlink") && item.status === "UNKNOWN",
      ),
    ).toBe(true);
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readData(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    return null;
  }
  return payload.data;
}

function readRunId(payload: unknown): string {
  const data = readData(payload);
  return typeof data?.id === "string" ? data.id : "";
}

function readUnknownCount(payload: unknown): number {
  const data = readData(payload);
  return typeof data?.unknownCount === "number" ? data.unknownCount : -1;
}

function readReadiness(payload: unknown): string {
  const data = readData(payload);
  const run = data !== null && isRecord(data.run) ? data.run : null;
  return typeof run?.readiness === "string" ? run.readiness : "";
}

function readBlockerCount(payload: unknown): number {
  const data = readData(payload);
  const run = data !== null && isRecord(data.run) ? data.run : null;
  return typeof run?.blockerCount === "number" ? run.blockerCount : -1;
}

function readFindings(payload: unknown): Array<{ status: string; title: string }> {
  const data = readData(payload);
  if (data === null || !Array.isArray(data.findings)) {
    return [];
  }
  return data.findings.flatMap((item) => {
    if (!isRecord(item) || typeof item.status !== "string" || typeof item.title !== "string") {
      return [];
    }
    return [{ status: item.status, title: item.title }];
  });
}
