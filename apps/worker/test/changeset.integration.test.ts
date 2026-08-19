import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { FileSystemArtifactStore } from "@chainport/changeset";
import {
  AnalysisRepository,
  ChangeSetRepository,
  getDatabaseClient,
  IngestRepository,
  PlanRepository,
  resetIntegrationDatabase,
} from "@chainport/db";
import { WorkspaceManager } from "@chainport/ingest";
import { createId, INTEGRATION_TEST_DATABASE_PURPOSE } from "@chainport/shared";

import { processFinalizeChangeSet, processGenerateChangeSet } from "../src/changeset-processor.js";
import { createLogger } from "../src/logger.js";

const fixtures = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../packages/changeset/test/fixtures/safe-repo",
);

const sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const usdcTarget = "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85";

describe("changeset processor", () => {
  const database = getDatabaseClient();
  const ingest = new IngestRepository(database);
  const analyses = new AnalysisRepository(database);
  const plans = new PlanRepository(database);
  const changeSets = new ChangeSetRepository(database);

  beforeEach(async () => {
    expect(process.env.CHAINPORT_DB_PURPOSE).toBe(INTEGRATION_TEST_DATABASE_PURPOSE);
    await resetIntegrationDatabase(database);
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it("generates, reviews, finalizes, and rolls back without mutating the original SHA", async () => {
    const seeded = await seed(database, ingest, analyses);
    const original = await changeSets.createOriginalRevision({
      projectId: seeded.project.id,
      repositoryId: seeded.repository.id,
      baseCommitSha: sha,
    });
    const changeSet = await changeSets.createQueued({
      projectId: seeded.project.id,
      migrationPlanId: seeded.planId,
      repositoryId: seeded.repository.id,
      originalRevisionId: original.id,
      baseCommitSha: sha,
      engineVersion: "1",
      idempotencyKey: `changeset:${seeded.planId}:${sha}:1`,
    });
    const workRoot = await mkdtemp(path.join(tmpdir(), "chainport-cs-work-"));
    const artifactRoot = await mkdtemp(path.join(tmpdir(), "chainport-cs-art-"));
    const deps = {
      ingest,
      plans,
      changeSets,
      workspaces: new WorkspaceManager(workRoot),
      artifacts: new FileSystemArtifactStore(artifactRoot),
      config: {
        CLONE_TIMEOUT_MS: 5_000,
        CLONE_MAX_BYTES: 10_000_000,
        ANALYSIS_MAX_FILE_BYTES: 500_000,
      },
      logger: createLogger({ service: "worker", level: "silent" }),
      materialize: materializeFixture,
    };

    await processGenerateChangeSet(changeSet.id, deps);
    const generated = await changeSets.getDetails(changeSet.id);
    expect(generated?.status).toBe("READY_FOR_REVIEW");
    const proposed = generated?.changes.filter((item) => item.status === "PROPOSED") ?? [];
    const skipped = generated?.changes.filter((item) => item.status === "SKIPPED") ?? [];
    expect(proposed.length).toBeGreaterThanOrEqual(2);
    expect(skipped.some((item) => item.skipReason === "UNSAFE_ENV_FILE")).toBe(true);
    expect(skipped.some((item) => item.skipReason === "PATH_ESCAPE_DETECTED")).toBe(true);
    expect(skipped.some((item) => item.skipReason === "PATCHER_UNSUPPORTED")).toBe(true);
    expect(generated?.changes.some((item) => item.migrationActionId === seeded.reviewId)).toBe(
      false,
    );
    expect(JSON.stringify(generated)).not.toContain("super-secret");
    expect(
      skipped.some(
        (item) => item.filePath.includes("..") && item.skipReason === "PATH_ESCAPE_DETECTED",
      ),
    ).toBe(true);

    const envChange = proposed.find((item) => item.filePath === ".env.example");
    const usdcChange = proposed.find((item) => item.filePath === "src/Token.sol");
    expect(envChange).toBeDefined();
    expect(usdcChange).toBeDefined();
    if (envChange === undefined || usdcChange === undefined) {
      return;
    }
    expect(envChange.unifiedDiff ?? "").toContain("-CHAIN_ID=8453");
    expect(envChange.unifiedDiff ?? "").toContain("+CHAIN_ID=10");
    await changeSets.setChangeStatus(envChange.id, "ACCEPTED");
    await changeSets.setChangeStatus(usdcChange.id, "REJECTED");

    const ready = await changeSets.getById(changeSet.id);
    expect(ready?.status).toBe("READY_FOR_REVIEW");
    await processFinalizeChangeSet(changeSet.id, deps);

    const finalized = await changeSets.getDetails(changeSet.id);
    expect(finalized?.status).toBe("FINALIZED");
    expect(finalized?.completeness).toBe("PARTIAL");
    expect(finalized?.generatedRevision?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    const revisionId = finalized?.generatedRevision?.id;
    expect(revisionId).toBeDefined();
    if (revisionId === undefined) {
      return;
    }
    const envPatched = await readFile(path.join(artifactRoot, revisionId, ".env.example"), "utf8");
    const tokenPatched = await readFile(
      path.join(artifactRoot, revisionId, "src/Token.sol"),
      "utf8",
    );
    expect(envPatched).toContain("CHAIN_ID=10");
    expect(envPatched).toContain("OTHER=keep");
    expect(tokenPatched).toContain("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(tokenPatched).not.toContain(usdcTarget);
    const originalEnv = await readFile(path.join(fixtures, ".env.example"), "utf8");
    expect(originalEnv).toContain("CHAIN_ID=8453");

    await changeSets.setActiveRevision(seeded.project.id, original.id);
    await changeSets.transition({
      changeSetId: changeSet.id,
      fromStatus: "FINALIZED",
      toStatus: "ROLLED_BACK",
      reason: "test rollback",
    });
    const project = await ingest.getProjectById(seeded.project.id);
    expect(project?.activeRevisionId).toBe(original.id);
    expect((await changeSets.getById(changeSet.id))?.status).toBe("ROLLED_BACK");
    expect((await changeSets.getDetails(changeSet.id))?.generatedRevision?.contentHash).toBe(
      finalized?.generatedRevision?.contentHash,
    );
  });
});

async function materializeFixture({ workspace }: { workspace: { root: string } }) {
  const repoPath = path.join(workspace.root, "repo");
  await cp(fixtures, repoPath, { recursive: true });
  await writeFile(path.join(repoPath, ".env"), "CHAIN_ID=8453\nSECRET=super-secret\n");
  return { repoPath, commitSha: sha, durationMs: 1 };
}

async function seed(
  database: ReturnType<typeof getDatabaseClient>,
  ingest: IngestRepository,
  analyses: AnalysisRepository,
) {
  const repository = await ingest.upsertRepository({
    owner: "acme",
    name: "safe-app",
    normalizedUrl: "https://github.com/acme/safe-app",
  });
  await ingest.markRepositoryReady({
    repositoryId: repository.id,
    defaultBranch: "main",
    resolvedCommitSha: sha,
    sizeBytes: 100,
  });
  const project = await ingest.upsertProject({
    repositoryId: repository.id,
    name: "acme/safe-app",
    githubUrl: repository.normalizedUrl,
    githubOwner: "acme",
    githubRepo: "safe-app",
    defaultBranch: "main",
  });
  const analysis = await analyses.create({
    projectId: project.id,
    repositoryId: repository.id,
    commitSha: sha,
    scannerVersion: "1",
    idempotencyKey: createId(),
  });
  await database.repositoryAnalysis.update({
    where: { id: analysis.id },
    data: { status: "COMPLETED" },
  });
  const snapshotHash = createId();
  await database.compatibilityRegistrySnapshot.create({
    data: {
      id: createId(),
      hash: snapshotHash,
      registryVersion: "1",
      targetChainKey: "optimism",
      canonicalJson: JSON.stringify({ rpcUrls: ["https://mainnet.optimism.io"] }),
    },
  });
  const run = await database.compatibilityRun.create({
    data: {
      id: createId(),
      projectId: project.id,
      analysisId: analysis.id,
      repositoryId: repository.id,
      commitSha: sha,
      sourceChainKey: "base",
      targetChainKey: "optimism",
      scannerVersion: "1",
      rulesetVersion: "1",
      registryVersion: "1",
      registrySnapshotHash: snapshotHash,
      score: 80,
      coverage: 80,
      coverageConfidence: "HIGH",
      readiness: "READY",
      status: "COMPLETED",
      idempotencyKey: createId(),
    },
  });
  const plan = await database.plannedMigration.create({
    data: {
      id: createId(),
      projectId: project.id,
      compatibilityRunId: run.id,
      repositoryId: repository.id,
      commitSha: sha,
      sourceChainKey: "base",
      targetChainKey: "optimism",
      registrySnapshotHash: snapshotHash,
      migrationRulesetVersion: "1",
      status: "COMPLETED",
      outcome: "READY_TO_APPLY",
      migrationReady: true,
      totalActions: 6,
      safeActionCount: 5,
      reviewActionCount: 1,
      manualActionCount: 0,
      blockedActionCount: 0,
      unknownActionCount: 0,
      autoFixablePercent: 80,
      verificationRequired: false,
      idempotencyKey: createId(),
    },
  });
  await addAction(database, plan.id, {
    key: "env:CHAIN_ID",
    title: "Replace CHAIN_ID",
    category: "ENV_CONFIG",
    source: "CHAIN_ID=8453",
    target: "10",
    file: ".env.example",
    line: 1,
    excerpt: "CHAIN_ID=8453",
    order: 1,
  });
  await addAction(database, plan.id, {
    key: "env:secret",
    title: "Secret env",
    category: "ENV_CONFIG",
    source: "CHAIN_ID=8453",
    target: "10",
    file: ".env",
    line: 1,
    excerpt: "CHAIN_ID=8453",
    order: 2,
  });
  await addAction(database, plan.id, {
    key: "token:USDC",
    title: "Map USDC",
    category: "TOKEN_ADDRESS",
    source: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    target: usdcTarget,
    file: "src/Token.sol",
    line: 7,
    excerpt: "USDC",
    order: 3,
  });
  await addAction(database, plan.id, {
    key: "token:WETH:base->optimism",
    title: "Map WETH",
    category: "TOKEN_ADDRESS",
    source: "0x4200000000000000000000000000000000000006",
    target: "0x4200000000000000000000000000000000000006",
    file: "src/Token.sol",
    line: 7,
    excerpt: "WETH",
    order: 4,
  });
  await addAction(database, plan.id, {
    key: "escape",
    title: "Escape",
    category: "CHAIN_ID",
    source: "8453",
    target: "10",
    file: "../etc/passwd",
    line: 1,
    excerpt: "8453",
    order: 5,
  });
  const reviewId = await addAction(database, plan.id, {
    key: "review",
    title: "Review",
    category: "RPC_URL",
    source: "https://mainnet.base.org",
    target: "https://mainnet.optimism.io",
    file: "foundry.toml",
    line: 3,
    excerpt: "eth_rpc_url",
    order: 6,
    level: "REVIEW_REQUIRED",
  });
  return { project, repository, planId: plan.id, reviewId };
}

async function addAction(
  database: ReturnType<typeof getDatabaseClient>,
  planId: string,
  input: {
    key: string;
    title: string;
    category: "ENV_CONFIG" | "TOKEN_ADDRESS" | "CHAIN_ID" | "RPC_URL";
    source: string;
    target: string;
    file: string;
    line: number;
    excerpt: string;
    order: number;
    level?: "SAFE_AUTOMATIC" | "REVIEW_REQUIRED";
  },
): Promise<string> {
  const id = createId();
  await database.plannedMigrationAction.create({
    data: {
      id,
      planId,
      semanticKey: input.key,
      ruleId: "test",
      ruleVersion: "1",
      title: input.title,
      description: input.title,
      technicalReason: input.title,
      category: input.category,
      stage: "NETWORK_CONFIGURATION",
      automationLevel: input.level ?? "SAFE_AUTOMATIC",
      riskLevel: "LOW",
      actionStatus: "PLANNED",
      sourceValue: input.source,
      targetValue: input.target,
      displayOrder: input.order,
      dependencyOrder: input.order,
      registryRefs: {},
      evidence: {
        create: {
          id: createId(),
          filePath: input.file,
          startLine: input.line,
          excerpt: input.excerpt,
        },
      },
    },
  });
  return id;
}
