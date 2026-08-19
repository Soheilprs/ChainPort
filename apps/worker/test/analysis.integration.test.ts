import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  AnalysisRepository,
  getDatabaseClient,
  IngestRepository,
  resetIntegrationDatabase,
} from "@chainport/db";
import { WorkspaceManager } from "@chainport/ingest";
import { analyzeRepository, SCANNER_VERSION } from "@chainport/scanner";
import { buildAnalysisIdempotencyKey, INTEGRATION_TEST_DATABASE_PURPOSE } from "@chainport/shared";

import { createLogger } from "../src/logger.js";
import { processAnalysisJob } from "../src/analysis-processor.js";

const fixtures = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../packages/scanner/test/fixtures/foundry",
);

describe("analysis processor", () => {
  const database = getDatabaseClient();
  const ingest = new IngestRepository(database);
  const analyses = new AnalysisRepository(database);
  const sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  beforeEach(async () => {
    expect(process.env.CHAINPORT_DB_PURPOSE).toBe(INTEGRATION_TEST_DATABASE_PURPOSE);
    await resetIntegrationDatabase(database);
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it("analyzes a stored SHA, persists requirements, and is idempotent per scanner version", async () => {
    const repository = await ingest.upsertRepository({
      owner: "acme",
      name: "foundry-app",
      normalizedUrl: "https://github.com/acme/foundry-app",
    });
    await ingest.markRepositoryReady({
      repositoryId: repository.id,
      defaultBranch: "main",
      resolvedCommitSha: sha,
      sizeBytes: 100,
    });
    const project = await ingest.upsertProject({
      repositoryId: repository.id,
      name: "acme/foundry-app",
      githubUrl: repository.normalizedUrl,
      githubOwner: "acme",
      githubRepo: "foundry-app",
      defaultBranch: "main",
    });
    const analysis = await analyses.create({
      projectId: project.id,
      repositoryId: repository.id,
      commitSha: sha,
      scannerVersion: SCANNER_VERSION,
      idempotencyKey: buildAnalysisIdempotencyKey({
        repositoryId: repository.id,
        commitSha: sha,
        scannerVersion: SCANNER_VERSION,
      }),
    });
    const root = await mkdtemp(path.join(tmpdir(), "chainport-analysis-"));
    await processAnalysisJob(analysis.id, {
      ingest,
      analyses,
      workspaces: new WorkspaceManager(root),
      config: {
        CLONE_TIMEOUT_MS: 10_000,
        CLONE_MAX_BYTES: 10_000_000,
        ANALYSIS_MAX_FILES: 200,
        ANALYSIS_MAX_FILE_BYTES: 500_000,
        ANALYSIS_MAX_TOTAL_BYTES: 2_000_000,
        ANALYSIS_MAX_DEPTH: 10,
      },
      logger: createLogger({ service: "worker", level: "silent" }),
      materialize: () => Promise.resolve({ repoPath: fixtures, commitSha: sha, durationMs: 1 }),
      analyze: analyzeRepository,
    });
    const completed = await analyses.getById(analysis.id);
    expect(completed?.status).toBe("COMPLETED");
    const details = await analyses.getDetails(analysis.id);
    expect(details?.requirements.some((item) => item.key === "FOUNDRY")).toBe(true);
    expect(details?.requirements.some((item) => item.key === "CHAINLINK")).toBe(true);
    const leftover = await analyses.findByIdempotencyKey(
      buildAnalysisIdempotencyKey({
        repositoryId: repository.id,
        commitSha: sha,
        scannerVersion: SCANNER_VERSION,
      }),
    );
    expect(leftover?.id).toBe(analysis.id);
  });
});
