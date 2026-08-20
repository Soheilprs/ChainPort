import { describe, expect, it } from "vitest";

import { evaluateEligibility } from "../src/eligibility.js";
import { DeploymentEngineError } from "../src/errors.js";
import type { EligibilityInput } from "../src/eligibility.js";

function base(overrides: Partial<EligibilityInput> = {}): EligibilityInput {
  const revision = {
    id: "rev-1",
    projectId: "p1",
    repositoryId: "r1",
    baseRevisionId: null,
    baseCommitSha: "aaa",
    type: "ORIGINAL" as const,
    changeSetId: null,
    contentHash: "git:aaa",
    completeness: null,
    createdAt: new Date(),
  };
  const validation = {
    id: "val-1",
    projectId: "p1",
    repositoryRevisionId: "rev-1",
    revisionType: "ORIGINAL" as const,
    baseCommitSha: "aaa",
    revisionContentHash: "git:aaa",
    engineVersion: "1",
    profile: "STANDARD_LOCAL" as const,
    framework: "FOUNDRY" as const,
    status: "COMPLETED" as const,
    outcome: "PASSED" as const,
    sandboxImage: null,
    sandboxImageDigest: null,
    runtimeVersion: null,
    buildStatus: "PASSED" as const,
    testStatus: "PASSED" as const,
    countsAvailable: true,
    testTotal: 1,
    testPassed: 1,
    testFailed: 0,
    testSkipped: 0,
    durationMs: 1,
    errorCode: null,
    errorMessage: null,
    idempotencyKey: "k",
    limitsJson: {},
    networkPolicy: "none",
    leaseOwner: null,
    leaseExpiresAt: null,
    startedAt: null,
    completedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const plan = {
    id: "plan-1",
    projectId: "p1",
    compatibilityRunId: "c1",
    repositoryId: "r1",
    commitSha: "aaa",
    sourceChainKey: "ethereum",
    targetChainKey: "base",
    registrySnapshotHash: "h",
    migrationRulesetVersion: "1",
    status: "COMPLETED" as const,
    outcome: "READY_TO_APPLY" as const,
    migrationReady: true,
    totalActions: 0,
    safeActionCount: 0,
    reviewActionCount: 0,
    manualActionCount: 0,
    blockedActionCount: 0,
    unknownActionCount: 0,
    autoFixablePercent: 0,
    verificationRequired: false,
    idempotencyKey: "p",
    errorCode: null,
    errorMessage: null,
    createdAt: new Date(),
    completedAt: new Date(),
    updatedAt: new Date(),
  };
  return { revision, validation, plan, changeSet: undefined, ...overrides };
}

describe("deployment eligibility", () => {
  it("allows an original revision only when the plan has zero actions and validation passed", () => {
    expect(evaluateEligibility(base()).eligible).toBe(true);
  });

  it("rejects unvalidated, failed, blocked, and partial revisions", () => {
    expect(() => evaluateEligibility(base({ validation: undefined }))).toThrow(
      DeploymentEngineError,
    );
    const failed = base();
    if (failed.validation !== undefined) {
      failed.validation = { ...failed.validation, outcome: "FAILED" };
    }
    expect(() => evaluateEligibility(failed)).toThrow(/did not pass/i);
    const blocked = base();
    if (blocked.plan !== undefined) {
      blocked.plan = { ...blocked.plan, blockedActionCount: 1, totalActions: 1 };
    }
    expect(() => evaluateEligibility(blocked)).toThrow(DeploymentEngineError);
    const partial = base();
    partial.revision = { ...partial.revision, completeness: "PARTIAL" };
    expect(() => evaluateEligibility(partial)).toThrow(DeploymentEngineError);
  });
});
