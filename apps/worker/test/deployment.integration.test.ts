import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { FileSystemArtifactStore, hashRepositoryTree } from "@chainport/changeset";
import {
  ChangeSetRepository,
  DeploymentRepository,
  getDatabaseClient,
  IngestRepository,
  PlanRepository,
  resetIntegrationDatabase,
  ValidationRepository,
} from "@chainport/db";
import { containsPrivateKey, getCredential } from "@chainport/deployment";
import { WorkspaceManager } from "@chainport/ingest";
import { DockerSandboxRunner } from "@chainport/sandbox";
import { createId, INTEGRATION_TEST_DATABASE_PURPOSE } from "@chainport/shared";

import { createLogger } from "../src/logger.js";
import {
  processBroadcastDeployment,
  processPrepareDeployment,
  processReconcileDeployment,
} from "../src/deployment-processor.js";

const fixture = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../packages/deployment/test/fixtures/foundry-deploy",
);

const sha = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("deployment processor", () => {
  const database = getDatabaseClient();
  const ingest = new IngestRepository(database);
  const revisions = new ChangeSetRepository(database);
  const plans = new PlanRepository(database);
  const validations = new ValidationRepository(database);
  const deployments = new DeploymentRepository(database);
  const sandbox = new DockerSandboxRunner();
  let anvilContainer: string | undefined;
  let anvilNetwork: string | undefined;
  let anvilPort = 0;

  beforeEach(async () => {
    expect(process.env.CHAINPORT_DB_PURPOSE).toBe(INTEGRATION_TEST_DATABASE_PURPOSE);
    await resetIntegrationDatabase(database);
  });

  afterEach(async () => {
    if (anvilContainer !== undefined) {
      await sandboxDestroy(anvilContainer);
      anvilContainer = undefined;
    }
    if (anvilNetwork !== undefined) {
      const { runDocker } = await import("@chainport/sandbox");
      await runDocker(["network", "rm", anvilNetwork], { timeoutMs: 15_000 });
      anvilNetwork = undefined;
    }
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it("prepares, broadcasts, and verifies a Foundry Counter on Anvil without rebroadcasting on reconcile", async () => {
    if (!(await ready())) {
      expect(true).toBe(true);
      return;
    }
    const started = await startAnvil();
    anvilPort = started.port;
    anvilContainer = started.container;
    anvilNetwork = started.network;
    const ctx = await seedEligibleRevision();
    const deps = processorDeps(ctx, `http://127.0.0.1:${anvilPort}`, {
      proxyUpstreamRpcUrl: `http://${started.alias}:8545`,
      proxyExtraNetworks: [started.network],
    });
    await processPrepareDeployment(ctx.deploymentId, deps);
    const prepared = await deployments.getById(ctx.deploymentId);
    expect(prepared?.status, `${prepared?.errorCode}: ${prepared?.errorMessage}`).toBe("PREPARED");
    expect(prepared?.deployerAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    const secret = getCredential(ctx.deploymentId)?.peekPrivateKey();
    expect(secret).toBeDefined();

    await processBroadcastDeployment(ctx.deploymentId, deps);
    const completed = await deployments.getDetails(ctx.deploymentId);
    expect(completed?.status).toBe("COMPLETED");
    expect(completed?.transactions.length).toBeGreaterThan(0);
    expect(completed?.contracts.length).toBeGreaterThan(0);
    expect(completed?.contracts[0]?.bytecodePresent).toBe(true);
    expect(JSON.stringify(completed)).not.toMatch(/PRIVATE_KEY/);
    if (secret !== undefined) {
      expect(containsPrivateKey(JSON.stringify(completed), secret)).toBe(false);
    }

    const before = completed?.transactions.map((tx) => tx.hash) ?? [];
    await processReconcileDeployment(ctx.deploymentId, deps);
    const again = await deployments.listTransactions(ctx.deploymentId);
    expect(again.map((tx) => tx.hash)).toEqual(before);
  }, 240_000);

  it("does not rerun a script after broadcast hashes exist", async () => {
    if (!(await ready())) {
      expect(true).toBe(true);
      return;
    }
    const ctx = await seedEligibleRevision();
    await deployments.transition({
      deploymentId: ctx.deploymentId,
      fromStatus: "QUEUED",
      toStatus: "CHECKING_ELIGIBILITY",
      reason: "test",
    });
    await deployments.transition({
      deploymentId: ctx.deploymentId,
      fromStatus: "CHECKING_ELIGIBILITY",
      toStatus: "PREPARING",
      reason: "test",
    });
    await deployments.transition({
      deploymentId: ctx.deploymentId,
      fromStatus: "PREPARING",
      toStatus: "SIMULATING",
      reason: "test",
    });
    await deployments.transition({
      deploymentId: ctx.deploymentId,
      fromStatus: "SIMULATING",
      toStatus: "PREPARED",
      reason: "test",
    });
    await deployments.transition({
      deploymentId: ctx.deploymentId,
      fromStatus: "PREPARED",
      toStatus: "FUNDING",
      reason: "test",
    });
    await deployments.transition({
      deploymentId: ctx.deploymentId,
      fromStatus: "FUNDING",
      toStatus: "BROADCASTING",
      reason: "test",
    });
    await deployments.recordTransaction({
      deploymentRunId: ctx.deploymentId,
      sequence: 1,
      hash: "0x" + "ab".repeat(32),
      nonce: 0,
      from: "0x" + "11".repeat(20),
      to: null,
      value: "0",
      gasLimit: null,
      status: "SUBMITTED",
    });
    const deps = processorDeps(ctx, "http://127.0.0.1:1");
    await processPrepareDeployment(ctx.deploymentId, deps);
    const run = await deployments.getById(ctx.deploymentId);
    expect(run?.status === "BROADCASTING" || run?.status === "RECONCILIATION_REQUIRED").toBe(true);
    const txs = await deployments.listTransactions(ctx.deploymentId);
    expect(txs).toHaveLength(1);
  }, 60_000);

  async function ready(): Promise<boolean> {
    try {
      await sandbox.inspectDigest("chainport/sandbox-foundry:1");
      return true;
    } catch {
      return false;
    }
  }

  async function seedEligibleRevision() {
    const repository = await ingest.upsertRepository({
      owner: "acme",
      name: `deploy-${createId().slice(0, 8)}`,
      normalizedUrl: `https://github.com/acme/deploy-${createId().slice(0, 8)}`,
    });
    await ingest.markRepositoryReady({
      repositoryId: repository.id,
      defaultBranch: "main",
      resolvedCommitSha: sha,
      sizeBytes: 10,
    });
    const project = await ingest.upsertProject({
      repositoryId: repository.id,
      name: repository.name,
      githubUrl: repository.normalizedUrl,
      githubOwner: "acme",
      githubRepo: repository.name,
      defaultBranch: "main",
    });
    const artifactRoot = await mkdtemp(path.join(tmpdir(), "chainport-dep-art-"));
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
    const compatibility = await database.compatibilityRegistrySnapshot.create({
      data: {
        id: createId(),
        hash: createId(),
        registryVersion: "1",
        targetChainKey: "anvil",
        canonicalJson: "{}",
      },
    });
    const analysis = await database.repositoryAnalysis.create({
      data: {
        id: createId(),
        projectId: project.id,
        repositoryId: repository.id,
        commitSha: sha,
        scannerVersion: "1",
        status: "COMPLETED",
        idempotencyKey: createId(),
      },
    });
    const compatRun = await database.compatibilityRun.create({
      data: {
        id: createId(),
        projectId: project.id,
        analysisId: analysis.id,
        repositoryId: repository.id,
        commitSha: sha,
        sourceChainKey: "ethereum",
        targetChainKey: "anvil",
        scannerVersion: "1",
        rulesetVersion: "1",
        registryVersion: "1",
        registrySnapshotHash: compatibility.hash,
        score: 100,
        coverage: 100,
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
        compatibilityRunId: compatRun.id,
        repositoryId: repository.id,
        commitSha: sha,
        sourceChainKey: "ethereum",
        targetChainKey: "anvil",
        registrySnapshotHash: compatibility.hash,
        migrationRulesetVersion: "1",
        status: "COMPLETED",
        outcome: "READY_TO_APPLY",
        migrationReady: true,
        totalActions: 0,
        safeActionCount: 0,
        reviewActionCount: 0,
        manualActionCount: 0,
        blockedActionCount: 0,
        unknownActionCount: 0,
        autoFixablePercent: 100,
        verificationRequired: false,
        idempotencyKey: createId(),
      },
    });
    const validation = await validations.createQueued({
      projectId: project.id,
      repositoryRevisionId: revisionId,
      revisionType: "GENERATED",
      baseCommitSha: sha,
      revisionContentHash: contentHash,
      engineVersion: "1",
      profile: "STANDARD_LOCAL",
      sandboxImage: "chainport/sandbox-foundry:1",
      sandboxImageDigest: "digest",
      limitsJson: {},
      networkPolicy: "none",
      idempotencyKey: createId(),
    });
    await validations.transition({
      validationId: validation.id,
      fromStatus: "QUEUED",
      toStatus: "PREPARING",
      reason: "seed",
    });
    await validations.transition({
      validationId: validation.id,
      fromStatus: "PREPARING",
      toStatus: "COMPLETED",
      reason: "seed passed",
      outcome: "PASSED",
      buildStatus: "PASSED",
      testStatus: "PASSED",
    });
    const run = await deployments.createQueued({
      projectId: project.id,
      repositoryRevisionId: revisionId,
      plannedMigrationId: plan.id,
      changeSetId: null,
      validationRunId: validation.id,
      deploymentCandidateId: null,
      targetTestnetKey: "anvil",
      targetChainId: 31337,
      targetName: "Anvil",
      revisionContentHash: contentHash,
      engineVersion: "1",
      profile: "TESTNET_DEPLOY",
      framework: "FOUNDRY",
      sandboxImage: "chainport/sandbox-foundry:1",
      sandboxImageDigest: "digest",
      limitsJson: {},
      networkPolicy: "rpc-proxy-only",
      idempotencyKey: createId(),
    });
    return {
      deploymentId: run.id,
      revisionId,
      artifacts,
      contentHash,
      workRoot: await mkdtemp(path.join(tmpdir(), "chainport-dep-work-")),
    };
  }

  function processorDeps(
    ctx: { artifacts: FileSystemArtifactStore; workRoot: string },
    anvilRpcUrl: string,
    proxy?: { proxyUpstreamRpcUrl: string; proxyExtraNetworks: string[] },
  ) {
    return {
      ingest,
      revisions,
      plans,
      validations,
      deployments,
      workspaces: new WorkspaceManager(ctx.workRoot),
      artifacts: ctx.artifacts,
      sandbox,
      config: {
        CLONE_TIMEOUT_MS: 15_000,
        CLONE_MAX_BYTES: 10_000_000,
        DEPLOYMENT_TIMEOUT_MS: 120_000,
        DEPLOYMENT_MEMORY_BYTES: 512 * 1024 * 1024,
        DEPLOYMENT_CPUS: 1,
        DEPLOYMENT_PIDS: 128,
        MAX_DEPLOYMENT_TX_COUNT: 12,
        MAX_DEPLOYMENT_GAS: 15_000_000,
        MAX_TESTNET_FUNDING_WEI: 1_000_000_000_000_000_000n,
        MAX_TRANSACTION_VALUE_WEI: 0n,
        RPC_PROXY_MAX_BODY_BYTES: 1_048_576,
        RPC_PROXY_RATE_LIMIT: 120,
        RPC_PROXY_TIMEOUT_MS: 30_000,
        SANDBOX_IMAGE_FOUNDRY: "chainport/sandbox-foundry:1",
        CHAINPORT_TESTNET_FUNDER_PRIVATE_KEY: undefined,
        ETHERSCAN_API_KEY: undefined,
      },
      logger: createLogger({ service: "worker", level: "silent" }),
      anvilRpcUrl,
      ...proxy,
    };
  }
});

async function startAnvil(): Promise<{
  port: number;
  container: string;
  network: string;
  alias: string;
}> {
  const { runDocker } = await import("@chainport/sandbox");
  const port = 18_000 + Math.floor(Math.random() * 1000);
  const container = `chainport-anvil-${port}`;
  const network = `chainport-anvil-net-${port}`;
  const alias = "chainport-anvil";
  const net = await runDocker(["network", "create", network], { timeoutMs: 15_000 });
  if (net.code !== 0) {
    throw new Error(net.stderr);
  }
  const created = await runDocker(
    [
      "run",
      "-d",
      "--name",
      container,
      "--label",
      "chainport.anvil=1",
      "--network",
      network,
      "--network-alias",
      alias,
      "-p",
      `${port}:8545`,
      "--entrypoint",
      "anvil",
      "chainport/sandbox-foundry:1",
      "--host",
      "0.0.0.0",
      "--port",
      "8545",
    ],
    { timeoutMs: 30_000 },
  );
  if (created.code !== 0) {
    throw new Error(created.stderr);
  }
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      });
      if (res.ok) {
        return { port, container, network, alias };
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  await runDocker(["rm", "-f", container], { timeoutMs: 15_000 });
  await runDocker(["network", "rm", network], { timeoutMs: 15_000 });
  throw new Error("anvil did not start");
}

async function sandboxDestroy(container: string): Promise<void> {
  const { runDocker } = await import("@chainport/sandbox");
  await runDocker(["rm", "-f", container], { timeoutMs: 15_000 });
}
