import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AnalysisRepository,
  ChangeSetRepository,
  getDatabaseClient,
  IngestRepository,
  PlanRepository,
  resetIntegrationDatabase,
} from "@chainport/db";
import { createId, INTEGRATION_TEST_DATABASE_PURPOSE } from "@chainport/shared";

import { createApiApplication } from "../src/app.js";
import { ChangeSetService } from "../src/changeset-service.js";
import { createLogger } from "../src/logger.js";

const sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const applications: Array<Awaited<ReturnType<typeof createApiApplication>>> = [];
const database = getDatabaseClient();
const ingest = new IngestRepository(database);
const analyses = new AnalysisRepository(database);
const plans = new PlanRepository(database);
const changeSets = new ChangeSetRepository(database);

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readData(payload: unknown): Record<string, unknown> | null {
  return isRecord(payload) && isRecord(payload.data) ? payload.data : null;
}

describe("changeset API", () => {
  it("is idempotent, enforces ownership, hides internals, and supports review/finalize/rollback", async () => {
    const seeded = await seedPlan("acme", "wallet");
    const other = await seedPlan("other", "app");
    const enqueueGenerate = vi.fn(() => Promise.resolve());
    const enqueueFinalize = vi.fn(() => Promise.resolve());
    const app = await createApiApplication({
      logger: createLogger({ service: "api", level: "silent" }),
      readinessProbe: () => Promise.resolve(),
      webOrigin: "http://localhost:3000",
      changeSetService: new ChangeSetService(plans, changeSets, {
        enqueueIngest: vi.fn(() => Promise.resolve()),
        enqueueAnalysis: vi.fn(() => Promise.resolve()),
        enqueueGenerateChangeSet: enqueueGenerate,
        enqueueFinalizeChangeSet: enqueueFinalize,
        close: () => Promise.resolve(),
      }),
    });
    applications.push(app);

    const missing = await app.inject({
      method: "POST",
      url: `/v1/migration-plans/${createId()}/change-sets`,
    });
    expect(missing.statusCode).toBe(404);

    const first = await app.inject({
      method: "POST",
      url: `/v1/migration-plans/${seeded.planId}/change-sets`,
    });
    expect(first.statusCode).toBe(201);
    const changeSetId = String(readData(first.json())?.id);
    const second = await app.inject({
      method: "POST",
      url: `/v1/migration-plans/${seeded.planId}/change-sets`,
    });
    expect(second.statusCode).toBe(200);
    expect(readData(second.json())?.id).toBe(changeSetId);
    expect(enqueueGenerate).toHaveBeenCalled();

    await changeSets.transition({
      changeSetId,
      fromStatus: "QUEUED",
      toStatus: "MATERIALIZING",
      reason: "test",
    });
    await changeSets.transition({
      changeSetId,
      fromStatus: "MATERIALIZING",
      toStatus: "GENERATING",
      reason: "test",
    });
    await changeSets.persistGenerated(changeSetId, [
      {
        migrationActionId: seeded.actionId,
        filePath: ".env.example",
        patcherId: "env-template",
        patcherVersion: "1",
        changeType: "REPLACE_VALUE",
        status: "PROPOSED",
        skipReason: null,
        sourceHash: "a",
        resultHash: "b",
        beforeExcerpt: "CHAIN_ID=8453",
        afterExcerpt: "CHAIN_ID=10",
        unifiedDiff: "--- a/.env.example\n+++ b/.env.example\n-CHAIN_ID=8453\n+CHAIN_ID=10\n",
        patchedText: "CHAIN_ID=10\n",
        sourceValue: "8453",
        targetValue: "10",
        reason: "Replace CHAIN_ID in env template",
      },
    ]);
    await changeSets.transition({
      changeSetId,
      fromStatus: "GENERATING",
      toStatus: "READY_FOR_REVIEW",
      reason: "test",
    });

    const details = await app.inject({ method: "GET", url: `/v1/change-sets/${changeSetId}` });
    expect(details.statusCode).toBe(200);
    expect(details.body).not.toContain("patchedText");
    expect(details.body).not.toContain("super-secret");
    const body = readData(details.json());
    const changes = Array.isArray(body?.changes) ? body.changes : [];
    const proposed = changes.filter(
      (item): item is Record<string, unknown> => isRecord(item) && item.status === "PROPOSED",
    );
    expect(proposed.length).toBe(1);
    const changeId = String(proposed[0]?.id);

    const otherSet = await app.inject({
      method: "POST",
      url: `/v1/migration-plans/${other.planId}/change-sets`,
    });
    const otherId = String(readData(otherSet.json())?.id);
    const cross = await app.inject({
      method: "POST",
      url: `/v1/change-sets/${otherId}/changes/${changeId}/accept`,
    });
    expect(cross.statusCode).toBe(404);

    const accept = await app.inject({
      method: "POST",
      url: `/v1/change-sets/${changeSetId}/changes/${changeId}/accept`,
    });
    expect(accept.statusCode).toBe(200);
    const acceptAll = await app.inject({
      method: "POST",
      url: `/v1/change-sets/${changeSetId}/accept-all`,
    });
    expect(acceptAll.statusCode).toBe(200);

    const finalize = await app.inject({
      method: "POST",
      url: `/v1/change-sets/${changeSetId}/finalize`,
    });
    expect(finalize.statusCode).toBe(200);
    expect(enqueueFinalize).toHaveBeenCalled();

    await changeSets.skipRemainingProposed(changeSetId);
    await changeSets.transition({
      changeSetId,
      fromStatus: "READY_FOR_REVIEW",
      toStatus: "FINALIZING",
      reason: "test",
    });
    const generated = await changeSets.createGeneratedRevision({
      id: createId(),
      projectId: seeded.project.id,
      repositoryId: seeded.repositoryId,
      baseRevisionId: String(readData(first.json())?.originalRevisionId),
      baseCommitSha: sha,
      changeSetId,
      contentHash: "abc123",
      completeness: "COMPLETE",
    });
    await changeSets.setCompleteness(changeSetId, "COMPLETE");
    await changeSets.setActiveRevision(seeded.project.id, generated.id);
    await changeSets.transition({
      changeSetId,
      fromStatus: "FINALIZING",
      toStatus: "FINALIZED",
      reason: "test",
    });

    const rollback = await app.inject({
      method: "POST",
      url: `/v1/change-sets/${changeSetId}/rollback`,
    });
    expect(rollback.statusCode).toBe(200);
    expect(readData(rollback.json())?.changeSet).toMatchObject({ status: "ROLLED_BACK" });
    const replay = await app.inject({
      method: "POST",
      url: `/v1/migration-plans/${seeded.planId}/change-sets`,
    });
    expect(readData(replay.json())?.id).toBe(changeSetId);
    expect(readData(replay.json())?.status).toBe("ROLLED_BACK");
  });
});

async function seedPlan(owner: string, name: string) {
  const repository = await ingest.upsertRepository({
    owner,
    name,
    normalizedUrl: `https://github.com/${owner}/${name}`,
  });
  await ingest.markRepositoryReady({
    repositoryId: repository.id,
    defaultBranch: "main",
    resolvedCommitSha: sha,
    sizeBytes: 12,
  });
  const project = await ingest.upsertProject({
    repositoryId: repository.id,
    name: `${owner}/${name}`,
    githubUrl: repository.normalizedUrl,
    githubOwner: owner,
    githubRepo: name,
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
      canonicalJson: "{}",
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
      totalActions: 1,
      safeActionCount: 1,
      reviewActionCount: 0,
      manualActionCount: 0,
      blockedActionCount: 0,
      unknownActionCount: 0,
      autoFixablePercent: 100,
      verificationRequired: false,
      idempotencyKey: createId(),
    },
  });
  const actionId = createId();
  await database.plannedMigrationAction.create({
    data: {
      id: actionId,
      planId: plan.id,
      semanticKey: "env:CHAIN_ID",
      ruleId: "test",
      ruleVersion: "1",
      title: "Replace CHAIN_ID",
      description: "Replace CHAIN_ID",
      technicalReason: "verified",
      category: "ENV_CONFIG",
      stage: "NETWORK_CONFIGURATION",
      automationLevel: "SAFE_AUTOMATIC",
      riskLevel: "LOW",
      actionStatus: "PLANNED",
      sourceValue: "CHAIN_ID=8453",
      targetValue: "10",
      displayOrder: 1,
      dependencyOrder: 1,
      registryRefs: {},
      evidence: {
        create: {
          id: createId(),
          filePath: ".env.example",
          startLine: 1,
          excerpt: "CHAIN_ID=8453",
        },
      },
    },
  });
  return { project, planId: plan.id, actionId, repositoryId: repository.id };
}
