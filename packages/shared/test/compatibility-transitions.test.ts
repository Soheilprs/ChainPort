import { describe, expect, it } from "vitest";

import {
  assertCompatibilityTransition,
  buildCompatibilityIdempotencyKey,
  InvalidCompatibilityTransitionError,
} from "../src/index.js";

describe("compatibility transitions", () => {
  it("allows queued evaluation to complete and forbids rewriting completed runs", () => {
    expect(() => assertCompatibilityTransition("QUEUED", "EVALUATING")).not.toThrow();
    expect(() => assertCompatibilityTransition("EVALUATING", "COMPLETED")).not.toThrow();
    expect(() => assertCompatibilityTransition("COMPLETED", "EVALUATING")).toThrow(
      InvalidCompatibilityTransitionError,
    );
  });

  it("builds a stable identity from analysis, target, ruleset, and snapshot", () => {
    expect(
      buildCompatibilityIdempotencyKey({
        analysisId: "a1",
        targetChainKey: "optimism",
        rulesetVersion: "1",
        registrySnapshotHash: "abc",
      }),
    ).toBe("compat:a1:optimism:1:abc");
  });
});
