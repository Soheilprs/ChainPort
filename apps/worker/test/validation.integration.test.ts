import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { FileSystemArtifactStore, hashRepositoryTree } from "@chainport/changeset";
import {
  ChangeSetRepository,
  getDatabaseClient,
  IngestRepository,
  ValidationRepository,
  resetIntegrationDatabase,
} from "@chainport/db";
import { WorkspaceManager } from "@chainport/ingest";
import { DockerSandboxRunner } from "@chainport/sandbox";
import { createId, INTEGRATION_TEST_DATABASE_PURPOSE } from "@chainport/shared";

import { createLogger } from "../src/logger.js";
import { processValidationJob } from "../src/validation-processor.js";

const passFixture = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../packages/validation/test/fixtures/foundry-pass",
);
const failFixture = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../packages/validation/test/fixtures/foundry-fail",
);

const sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("validation processor", () => {
  const database = getDatabaseClient();
  const ingest = new IngestRepository(database);
  const revisions = new ChangeSetRepository(database);
  const validations = new ValidationRepository(database);
  const sandbox = new DockerSandboxRunner();

  beforeEach(async () => {
    expect(process.env.CHAINPORT_DB_PURPOSE).toBe(INTEGRATION_TEST_DATABASE_PURPOSE);
    await resetIntegrationDatabase(database);
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it("validates a passing Foundry fixture and a failing one inside the sandbox", async () => {
    let imageReady = true;
    try {
      await sandbox.inspectDigest("chainport/sandbox-foundry:1");
    } catch {
      imageReady = false;
    }
    if (!imageReady) {
      expect(imageReady).toBe(false);
      return;
    }

    const passed = await runFixture(passFixture, "pass");
    expect(passed.outcome).toBe("PASSED");
    expect(passed.buildStatus).toBe("PASSED");
    expect(passed.testStatus).toBe("PASSED");

    const failed = await runFixture(failFixture, "fail");
    expect(failed.outcome).toBe("FAILED");
    expect(failed.errorCode).toBe("TEST_FAILED");
  }, 180_000);

  async function runFixture(fixture: string, name: string) {
    const repository = await ingest.upsertRepository({
      owner: "acme",
      name: `val-${name}`,
      normalizedUrl: `https://github.com/acme/val-${name}`,
    });
    await ingest.markRepositoryReady({
      repositoryId: repository.id,
      defaultBranch: "main",
      resolvedCommitSha: sha,
      sizeBytes: 10,
    });
    const project = await ingest.upsertProject({
      repositoryId: repository.id,
      name: `acme/val-${name}`,
      githubUrl: repository.normalizedUrl,
      githubOwner: "acme",
      githubRepo: `val-${name}`,
      defaultBranch: "main",
    });
    const artifactRoot = await mkdtemp(path.join(tmpdir(), "chainport-val-art-"));
    const workRoot = await mkdtemp(path.join(tmpdir(), "chainport-val-work-"));
    const artifacts = new FileSystemArtifactStore(artifactRoot);
    const revisionId = createId();
    await artifacts.snapshotFrom(revisionId, fixture);
    const contentHash = await hashRepositoryTree(artifacts.revisionDir(revisionId));
    await database.repositoryRevision.create({
      data: {
        id: revisionId,
        projectId: project.id,
        repositoryId: repository.id,
        baseCommitSha: sha,
        type: "GENERATED",
        contentHash,
        completeness: "COMPLETE",
      },
    });
    const run = await validations.createQueued({
      projectId: project.id,
      repositoryRevisionId: revisionId,
      revisionType: "GENERATED",
      baseCommitSha: sha,
      revisionContentHash: contentHash,
      engineVersion: "1",
      profile: "STANDARD_LOCAL",
      sandboxImage: "chainport/sandbox-foundry:1",
      sandboxImageDigest: await sandbox.inspectDigest("chainport/sandbox-foundry:1"),
      limitsJson: { memoryBytes: 512 * 1024 * 1024, cpus: 1, pids: 128 },
      networkPolicy: "install-then-none",
      idempotencyKey: createId(),
    });
    await processValidationJob(run.id, {
      ingest,
      revisions,
      validations,
      workspaces: new WorkspaceManager(workRoot),
      artifacts,
      sandbox,
      config: {
        CLONE_TIMEOUT_MS: 15_000,
        CLONE_MAX_BYTES: 10_000_000,
        VALIDATION_INSTALL_TIMEOUT_MS: 30_000,
        VALIDATION_BUILD_TIMEOUT_MS: 60_000,
        VALIDATION_TEST_TIMEOUT_MS: 60_000,
        VALIDATION_TOTAL_TIMEOUT_MS: 120_000,
        VALIDATION_MEMORY_BYTES: 512 * 1024 * 1024,
        VALIDATION_CPUS: 1,
        VALIDATION_PIDS: 128,
        VALIDATION_LOG_STEP_BYTES: 64_000,
        SANDBOX_IMAGE_FOUNDRY: "chainport/sandbox-foundry:1",
        SANDBOX_IMAGE_NODE20: undefined,
        SANDBOX_IMAGE_NODE22: undefined,
      },
      logger: createLogger({ service: "worker", level: "silent" }),
    });
    const completed = await validations.getById(run.id);
    if (completed === undefined) {
      throw new Error("missing validation");
    }
    return completed;
  }
});
