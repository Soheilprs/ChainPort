import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getDatabaseClient, PartnerRepository, resetIntegrationDatabase } from "@chainport/db";
import { createId, INTEGRATION_TEST_DATABASE_PURPOSE } from "@chainport/shared";

import { EcosystemAnalytics } from "../src/analytics.js";
import { parseAnalyticsRange } from "../src/range.js";

const sha = (n: number) => n.toString(16).padStart(40, "a");
const database = getDatabaseClient();
const partners = new PartnerRepository(database);
const analytics = new EcosystemAnalytics(database);

beforeEach(async () => {
  expect(process.env.CHAINPORT_DB_PURPOSE).toBe(INTEGRATION_TEST_DATABASE_PURPOSE);
  await resetIntegrationDatabase(database);
});

afterAll(async () => {
  await database.$disconnect();
});

describe("ecosystem analytics", () => {
  it("counts unique projects in the funnel and does not double-count reruns", async () => {
    const partner = await partners.create({
      networkKey: "optimism",
      displayName: "Optimism",
    });
    await seedJourney("a", {});
    await seedJourney("b", { analyzed: true });
    await seedJourney("c", { analyzed: true, compatibility: "BLOCKED" });
    await seedJourney("d", { analyzed: true, compatibility: "READY", planned: true });
    await seedJourney("e", {
      analyzed: true,
      compatibility: "READY",
      planned: true,
      validation: "FAILED",
    });
    await seedJourney("f", {
      analyzed: true,
      compatibility: "READY",
      planned: true,
      validation: "PASSED",
    });
    await seedJourney("g", {
      analyzed: true,
      compatibility: "READY",
      planned: true,
      validation: "PASSED",
      deployment: "COMPLETED",
      targetTestnetKey: "optimism-sepolia",
    });
    const f = await database.project.findFirst({ where: { githubRepo: "proj-f" } });
    if (f !== null) {
      await addCompatibility(f.id, f.repositoryId, "READY", []);
    }
    const funnel = await analytics.funnel(partner, {
      range: parseAnalyticsRange({ range: "all" }),
    });
    expect(funnel.counts.PROJECT_STARTED).toBe(7);
    expect(funnel.counts.REPOSITORY_ANALYZED).toBe(6);
    expect(funnel.counts.COMPATIBILITY_EVALUATED).toBe(5);
    expect(funnel.counts.MIGRATION_PLAN_CREATED).toBe(4);
    expect(funnel.counts.VALIDATION_PASSED).toBe(2);
    expect(funnel.counts.TESTNET_DEPLOYED).toBe(1);
    expect(funnel.conversions.startedToDeployed).toBeCloseTo(1 / 7);
  });

  it("classifies infrastructure gaps and excludes hardcoded chain IDs", async () => {
    const partner = await partners.create({ networkKey: "optimism", displayName: "Optimism" });
    for (const name of ["o1", "o2", "o3"]) {
      await seedJourney(name, {
        analyzed: true,
        compatibility: "BLOCKED",
        findings: [oracleFinding()],
      });
    }
    for (const name of ["z1", "z2"]) {
      await seedJourney(name, {
        analyzed: true,
        compatibility: "INSUFFICIENT_DATA",
        findings: [layerZeroFinding()],
      });
    }
    for (const name of ["c1", "c2", "c3", "c4"]) {
      await seedJourney(name, {
        analyzed: true,
        compatibility: "REVIEW_REQUIRED",
        findings: [chainIdFinding()],
      });
    }
    const gaps = await analytics.infrastructureGaps(partner, {
      range: parseAnalyticsRange({ range: "all" }),
    });
    const oracle = gaps.find((item) => item.key.includes("ETH/USD"));
    const layerzero = gaps.find((item) => item.key.includes("LAYERZERO"));
    const chainId = gaps.find(
      (item) => item.key.includes("chain-id") || item.title.includes("chain ID"),
    );
    expect(oracle?.kind).toBe("NETWORK_GAP");
    expect(oracle?.affectedProjects).toBe(3);
    expect(layerzero?.kind).toBe("UNKNOWN_NETWORK_DATA");
    expect(layerzero?.affectedProjects).toBe(2);
    expect(chainId).toBeUndefined();
  });

  it("separates repository validation failures from ChainPort infra failures", async () => {
    const partner = await partners.create({ networkKey: "optimism", displayName: "Optimism" });
    await seedJourney("pass", { analyzed: true, validation: "PASSED" });
    await seedJourney("build", { analyzed: true, validation: "FAILED", errorCode: "BUILD_FAILED" });
    await seedJourney("test", { analyzed: true, validation: "FAILED", errorCode: "TEST_FAILED" });
    await seedJourney("partial", { analyzed: true, validation: "PARTIAL" });
    await seedJourney("unsupported", { analyzed: true, validation: "UNSUPPORTED" });
    await seedJourney("infra", { analyzed: true, validation: "INFRA_FAILURE" });
    const result = await analytics.validations(partner, {
      range: parseAnalyticsRange({ range: "all" }),
    });
    expect(result.outcomes.PASSED).toBe(1);
    expect(result.outcomes.FAILED).toBe(2);
    expect(result.outcomes.PARTIAL).toBe(1);
    expect(result.outcomes.UNSUPPORTED).toBe(1);
    expect(result.outcomes.INFRA_FAILURE).toBe(1);
    expect(result.infraFailures).toBe(1);
    expect(result.repositoryFailures).toBe(4);
  });

  it("excludes Anvil DEVNET successes from partner deployment metrics", async () => {
    const partner = await partners.create({ networkKey: "optimism", displayName: "Optimism" });
    await seedJourney("prep", {
      analyzed: true,
      validation: "PASSED",
      deployment: "PREPARED",
      targetTestnetKey: "optimism-sepolia",
    });
    await seedJourney("ok", {
      analyzed: true,
      validation: "PASSED",
      deployment: "COMPLETED",
      targetTestnetKey: "optimism-sepolia",
    });
    await seedJourney("fail", {
      analyzed: true,
      validation: "PASSED",
      deployment: "FAILED",
      targetTestnetKey: "optimism-sepolia",
    });
    await seedJourney("recon", {
      analyzed: true,
      validation: "PASSED",
      deployment: "RECONCILIATION_REQUIRED",
      targetTestnetKey: "optimism-sepolia",
    });
    await seedJourney("anvil", {
      analyzed: true,
      validation: "PASSED",
      deployment: "COMPLETED",
      targetTestnetKey: "anvil",
    });
    const result = await analytics.deployments(partner, {
      range: parseAnalyticsRange({ range: "all" }),
    });
    expect(result.prepared).toBe(3);
    expect(result.success).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.reconciliationRequired).toBe(1);
    expect(result.anvilSuccessExcluded).toBe(1);
    const funnel = await analytics.funnel(partner, {
      range: parseAnalyticsRange({ range: "all" }),
    });
    expect(funnel.counts.TESTNET_DEPLOYED).toBe(1);
  });

  it("filters funnel membership by project createdAt in UTC", async () => {
    const partner = await partners.create({ networkKey: "optimism", displayName: "Optimism" });
    const old = await seedJourney("old", { analyzed: true });
    const recent = await seedJourney("new", { analyzed: true });
    await database.project.update({
      where: { id: old },
      data: { createdAt: new Date("2026-01-01T00:00:00.000Z") },
    });
    await database.project.update({
      where: { id: recent },
      data: { createdAt: new Date("2026-08-18T00:00:00.000Z") },
    });
    const week = await analytics.funnel(partner, {
      range: parseAnalyticsRange({
        from: "2026-08-13T00:00:00.000Z",
        to: "2026-08-21T00:00:00.000Z",
      }),
    });
    expect(week.counts.PROJECT_STARTED).toBe(1);
    const all = await analytics.funnel(partner, { range: parseAnalyticsRange({ range: "all" }) });
    expect(all.counts.PROJECT_STARTED).toBe(2);
  });

  it("excludes INTERNAL_TEST projects from partner metrics by default", async () => {
    const partner = await partners.create({ networkKey: "optimism", displayName: "Optimism" });
    await seedJourney("real", { analyzed: true, classification: "PRODUCTION" });
    await seedJourney("fixture", { analyzed: true, classification: "INTERNAL_TEST" });
    const hidden = await analytics.funnel(partner, {
      range: parseAnalyticsRange({ range: "all" }),
    });
    expect(hidden.counts.PROJECT_STARTED).toBe(1);
    const shown = await analytics.funnel(partner, {
      range: parseAnalyticsRange({ range: "all" }),
      includeInternal: true,
    });
    expect(shown.counts.PROJECT_STARTED).toBe(2);
  });

  it("returns empty funnel metrics without inventing values", async () => {
    const partner = await partners.create({ networkKey: "optimism", displayName: "Optimism" });
    const funnel = await analytics.funnel(partner, {
      range: parseAnalyticsRange({ range: "all" }),
    });
    expect(funnel.counts.PROJECT_STARTED).toBe(0);
    expect(funnel.conversions.startedToDeployed).toBeNull();
  });
});

async function seedJourney(
  name: string,
  opts: {
    classification?: "PRODUCTION" | "INTERNAL_TEST";
    analyzed?: boolean;
    compatibility?: "READY" | "BLOCKED" | "REVIEW_REQUIRED" | "INSUFFICIENT_DATA";
    findings?: Array<Parameters<typeof addCompatibility>[3][number]>;
    planned?: boolean;
    validation?: "PASSED" | "FAILED" | "PARTIAL" | "UNSUPPORTED" | "INFRA_FAILURE";
    errorCode?: string;
    deployment?: "PREPARED" | "COMPLETED" | "FAILED" | "RECONCILIATION_REQUIRED";
    targetTestnetKey?: string;
  },
): Promise<string> {
  const repository = await database.repository.create({
    data: {
      id: createId(),
      provider: "GITHUB",
      owner: "live",
      name: `proj-${name}`,
      normalizedUrl: `https://github.com/live/proj-${name}`,
      cloneStatus: "READY",
      resolvedCommitSha: sha(name.charCodeAt(0)),
    },
  });
  const project = await database.project.create({
    data: {
      id: createId(),
      repositoryId: repository.id,
      name: `live/proj-${name}`,
      githubUrl: repository.normalizedUrl,
      githubOwner: "live",
      githubRepo: `proj-${name}`,
      defaultBranch: "main",
      dataClassification: opts.classification ?? "PRODUCTION",
    },
  });
  await database.migrationJob.create({
    data: {
      id: createId(),
      projectId: project.id,
      repositoryId: repository.id,
      sourceChainKey: "ethereum",
      targetChainKey: "optimism",
      repoSha: sha(name.charCodeAt(0)),
      status: "COMPLETED",
      idempotencyKey: createId(),
    },
  });
  let analysisId: string | undefined;
  if (opts.analyzed === true || opts.compatibility !== undefined || opts.planned === true) {
    analysisId = createId();
    await database.repositoryAnalysis.create({
      data: {
        id: analysisId,
        projectId: project.id,
        repositoryId: repository.id,
        commitSha: sha(name.charCodeAt(0)),
        scannerVersion: "1",
        status: "COMPLETED",
        idempotencyKey: createId(),
        completedAt: new Date(),
      },
    });
  }
  if (opts.compatibility !== undefined && analysisId !== undefined) {
    await addCompatibility(
      project.id,
      repository.id,
      opts.compatibility,
      opts.findings ?? [],
      analysisId,
    );
  }
  if (opts.planned === true && analysisId !== undefined) {
    const compat = await database.compatibilityRun.findFirst({ where: { projectId: project.id } });
    if (compat !== null) {
      await database.plannedMigration.create({
        data: {
          id: createId(),
          projectId: project.id,
          compatibilityRunId: compat.id,
          repositoryId: repository.id,
          commitSha: sha(name.charCodeAt(0)),
          sourceChainKey: "ethereum",
          targetChainKey: "optimism",
          registrySnapshotHash: compat.registrySnapshotHash,
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
          completedAt: new Date(),
        },
      });
    }
  }
  if (opts.validation !== undefined || opts.deployment !== undefined) {
    const revision = await database.repositoryRevision.create({
      data: {
        id: createId(),
        projectId: project.id,
        repositoryId: repository.id,
        baseCommitSha: sha(name.charCodeAt(0)),
        type: "ORIGINAL",
        contentHash: `git:${sha(name.charCodeAt(0))}`,
      },
    });
    if (opts.validation !== undefined) {
      await database.validationRun.create({
        data: {
          id: createId(),
          projectId: project.id,
          repositoryRevisionId: revision.id,
          revisionType: "ORIGINAL",
          baseCommitSha: sha(name.charCodeAt(0)),
          revisionContentHash: `git:${sha(name.charCodeAt(0))}`,
          engineVersion: "1",
          profile: "STANDARD_LOCAL",
          status: "COMPLETED",
          outcome: opts.validation,
          errorCode: opts.errorCode ?? null,
          idempotencyKey: createId(),
          limitsJson: {},
          networkPolicy: "none",
          completedAt: new Date(),
        },
      });
    }
    if (opts.deployment !== undefined) {
      const validation = await database.validationRun.findFirst({
        where: { projectId: project.id },
      });
      if (validation !== null) {
        await database.deploymentRun.create({
          data: {
            id: createId(),
            projectId: project.id,
            repositoryRevisionId: revision.id,
            validationRunId: validation.id,
            targetTestnetKey: opts.targetTestnetKey ?? "optimism-sepolia",
            targetChainId: opts.targetTestnetKey === "anvil" ? 31337 : 11155420,
            targetName: opts.targetTestnetKey === "anvil" ? "Anvil" : "OP Sepolia",
            revisionContentHash: revision.contentHash,
            engineVersion: "1",
            profile: "TESTNET_DEPLOY",
            status: opts.deployment,
            idempotencyKey: createId(),
            limitsJson: {},
            networkPolicy: "rpc-proxy-only",
            broadcastStartedAt:
              opts.deployment === "COMPLETED" || opts.deployment === "RECONCILIATION_REQUIRED"
                ? new Date()
                : null,
            completedAt: opts.deployment === "PREPARED" ? null : new Date(),
          },
        });
      }
    }
  }
  return project.id;
}

async function addCompatibility(
  projectId: string,
  repositoryId: string,
  readiness: "READY" | "BLOCKED" | "REVIEW_REQUIRED" | "INSUFFICIENT_DATA",
  findings: Array<{
    ruleId: string;
    status: "BLOCKER" | "WARNING" | "UNKNOWN" | "PASS";
    category: "ORACLES" | "CROSS_CHAIN" | "CONFIGURATION";
    remediationType: "INFRASTRUCTURE_REQUIRED" | "UNKNOWN" | "CONFIG_CHANGE";
    sourceValue: string;
    targetValue: string;
    title: string;
  }>,
  analysisId?: string,
) {
  const analysis =
    analysisId === undefined
      ? await database.repositoryAnalysis.findFirst({ where: { projectId } })
      : await database.repositoryAnalysis.findUnique({ where: { id: analysisId } });
  if (analysis === null || analysis === undefined) {
    throw new Error("analysis missing");
  }
  const snapshot = await database.compatibilityRegistrySnapshot.create({
    data: {
      id: createId(),
      hash: createId(),
      registryVersion: "1",
      targetChainKey: "optimism",
      canonicalJson: "{}",
    },
  });
  const run = await database.compatibilityRun.create({
    data: {
      id: createId(),
      projectId,
      analysisId: analysis.id,
      repositoryId,
      commitSha: analysis.commitSha,
      sourceChainKey: "ethereum",
      targetChainKey: "optimism",
      scannerVersion: "1",
      rulesetVersion: "1",
      registryVersion: "1",
      registrySnapshotHash: snapshot.hash,
      score: readiness === "READY" ? 90 : 40,
      coverage: 80,
      coverageConfidence: "MEDIUM",
      readiness,
      status: "COMPLETED",
      blockerCount: findings.filter((item) => item.status === "BLOCKER").length,
      unknownCount: findings.filter((item) => item.status === "UNKNOWN").length,
      idempotencyKey: createId(),
      completedAt: new Date(),
    },
  });
  for (const finding of findings) {
    await database.compatibilityFinding.create({
      data: {
        id: createId(),
        compatibilityRunId: run.id,
        ruleId: finding.ruleId,
        ruleVersion: "1",
        category: finding.category,
        status: finding.status,
        title: finding.title,
        summary: finding.title,
        technicalReason: finding.title,
        remediationType: finding.remediationType,
        sourceValue: finding.sourceValue,
        targetValue: finding.targetValue,
        confidence: "HIGH",
        registryEvidence: {},
      },
    });
  }
  return run;
}

function oracleFinding() {
  return {
    ruleId: "oracle-availability",
    status: "BLOCKER" as const,
    category: "ORACLES" as const,
    remediationType: "INFRASTRUCTURE_REQUIRED" as const,
    sourceValue: "CHAINLINK_PRICE_FEED:ETH/USD",
    targetValue: "UNAVAILABLE",
    title: "Chainlink ETH/USD unavailable",
  };
}

function layerZeroFinding() {
  return {
    ruleId: "layerzero",
    status: "UNKNOWN" as const,
    category: "CROSS_CHAIN" as const,
    remediationType: "UNKNOWN" as const,
    sourceValue: "LAYERZERO",
    targetValue: "UNKNOWN",
    title: "LayerZero availability unknown",
  };
}

function chainIdFinding() {
  return {
    ruleId: "chain-id",
    status: "BLOCKER" as const,
    category: "CONFIGURATION" as const,
    remediationType: "CONFIG_CHANGE" as const,
    sourceValue: "1",
    targetValue: "10",
    title: "Hardcoded chain ID",
  };
}
