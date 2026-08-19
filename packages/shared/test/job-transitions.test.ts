import { describe, expect, it } from "vitest";

import {
  assertJobTransition,
  buildJobIdempotencyKey,
  canRetryJob,
  executableStageIndex,
  InvalidJobTransitionError,
  isJobTransitionAllowed,
  JOB_STATUSES,
  nextJobStage,
} from "../src/index.js";

describe("job transitions", () => {
  it("allows the documented happy path", () => {
    expect(isJobTransitionAllowed("QUEUED", "INGESTING")).toBe(true);
    expect(isJobTransitionAllowed("PLANNING", "PATCHING")).toBe(true);
    expect(isJobTransitionAllowed("PLANNING", "COMPLETED")).toBe(true);
    expect(isJobTransitionAllowed("TESTING", "COMPLETED")).toBe(true);
    expect(isJobTransitionAllowed("VERIFYING", "COMPLETED")).toBe(true);
  });

  it("rejects skipped stages and terminal mutation except retry", () => {
    expect(isJobTransitionAllowed("QUEUED", "ANALYZING")).toBe(false);
    expect(isJobTransitionAllowed("COMPLETED", "QUEUED")).toBe(false);
    expect(isJobTransitionAllowed("CANCELLED", "QUEUED")).toBe(false);
    expect(isJobTransitionAllowed("FAILED", "QUEUED")).toBe(true);
    expect(() => assertJobTransition("ANALYZING", "DEPLOYING")).toThrow(InvalidJobTransitionError);
  });

  it("covers every status in the transition table", () => {
    for (const status of JOB_STATUSES) {
      expect(isJobTransitionAllowed(status, status)).toBe(false);
    }
  });

  it("advances stages and computes executable indexes", () => {
    expect(nextJobStage("INGESTING")).toBe("ANALYZING");
    expect(nextJobStage("VERIFYING")).toBe("COMPLETED");
    expect(executableStageIndex("QUEUED")).toBe(0);
    expect(executableStageIndex("ANALYZING")).toBe(1);
    expect(() => executableStageIndex("COMPLETED")).toThrow(/not executable/);
  });

  it("allows retries only while attempts remain", () => {
    expect(canRetryJob("FAILED", 1, 3)).toBe(true);
    expect(canRetryJob("FAILED", 3, 3)).toBe(false);
    expect(canRetryJob("COMPLETED", 1, 3)).toBe(false);
  });

  it("builds a stable idempotency key", () => {
    expect(
      buildJobIdempotencyKey({
        projectId: "project-1",
        sourceChainKey: "ethereum",
        targetChainKey: "base",
        repoSha: "abc123",
      }),
    ).toBe("project-1:ethereum:base:abc123");
  });
});
