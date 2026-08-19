import { describe, expect, it } from "vitest";

import { compareValidations } from "../src/compare.js";
import { boundLog, redactLogs, stripAnsi } from "../src/logs.js";
import { parseForgeOutput } from "../src/parse.js";
import { selectProfile } from "../src/profile.js";
import type { DetectedWorkspace } from "../src/detect.js";

function detected(partial: Partial<DetectedWorkspace>): DetectedWorkspace {
  return {
    framework: "FOUNDRY",
    packageManager: null,
    nodeMajor: null,
    hasLockfile: false,
    hasLifecycleScripts: false,
    hasFoundryToml: true,
    hasLib: true,
    hasGitmodules: false,
    dockerRequired: false,
    reason: null,
    ...partial,
  };
}

describe("validation profile", () => {
  it("selects forge build/test without install when lib is vendored", () => {
    const profile = selectProfile(detected({}));
    expect(profile.unsupportedCode).toBeNull();
    expect(profile.commands.map((item) => item.argv[0])).toEqual(["forge", "forge"]);
    expect(profile.commands.every((item) => item.network === "none")).toBe(true);
  });

  it("refuses unsupported Node versions and missing Hardhat lockfiles", () => {
    expect(
      selectProfile(
        detected({ framework: "HARDHAT", nodeMajor: 16, hasLockfile: true, packageManager: "npm" }),
      ).unsupportedCode,
    ).toBe("UNSUPPORTED_RUNTIME_VERSION");
    expect(
      selectProfile(detected({ framework: "HARDHAT", hasLockfile: false, packageManager: null }))
        .unsupportedCode,
    ).toBe("DEPENDENCY_RESOLUTION_FAILED");
  });
});

describe("forge parser and logs", () => {
  it("parses suite results and redacts secrets", () => {
    const parsed = parseForgeOutput(
      "Suite result: FAILED. 2 passed; 1 failed; 0 skipped\n[FAIL] testFoo()",
    );
    expect(parsed.countsAvailable).toBe(true);
    expect(parsed.failed).toBe(1);
    expect(redactLogs("PRIVATE_KEY=0xabc\u001B[31mred")).not.toContain("\u001B");
    expect(stripAnsi("\u001B[0mhi")).toBe("hi");
    expect(boundLog("abcd", 2).truncated).toBe(true);
  });
});

describe("regression comparison", () => {
  const base = {
    id: "1",
    projectId: "p",
    repositoryRevisionId: "r",
    revisionType: "ORIGINAL" as const,
    baseCommitSha: "a".repeat(40),
    revisionContentHash: "h",
    engineVersion: "1",
    profile: "STANDARD_LOCAL" as const,
    framework: "FOUNDRY" as const,
    status: "COMPLETED" as const,
    sandboxImage: "img",
    sandboxImageDigest: "sha",
    runtimeVersion: "forge",
    buildStatus: "PASSED" as const,
    testStatus: "PASSED" as const,
    countsAvailable: true,
    testTotal: 1,
    testPassed: 1,
    testFailed: 0,
    testSkipped: 0,
    durationMs: 10,
    errorCode: null,
    errorMessage: null,
    idempotencyKey: "k",
    outcome: "PASSED" as const,
    limitsJson: {},
    networkPolicy: "install-then-none",
    leaseOwner: null,
    leaseExpiresAt: null,
    startedAt: new Date(),
    completedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("detects regression, baseline failure, and no regression", () => {
    expect(
      compareValidations(
        { ...base, outcome: "PASSED" },
        { ...base, outcome: "FAILED", revisionType: "GENERATED" },
      ).regressionStatus,
    ).toBe("REGRESSION_DETECTED");
    expect(
      compareValidations(
        { ...base, outcome: "FAILED" },
        { ...base, outcome: "FAILED", revisionType: "GENERATED" },
      ).regressionStatus,
    ).toBe("BASELINE_ALREADY_FAILING");
    expect(
      compareValidations(
        { ...base, outcome: "PASSED" },
        { ...base, outcome: "PASSED", revisionType: "GENERATED" },
      ).regressionStatus,
    ).toBe("NO_REGRESSION");
  });
});
