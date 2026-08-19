import { describe, expect, it } from "vitest";

import { determineReadiness, scoreFindings } from "../src/index.js";
import type { CompatibilityEvaluation } from "../src/types.js";

function finding(
  status: CompatibilityEvaluation["status"],
  category: CompatibilityEvaluation["category"],
): CompatibilityEvaluation {
  return {
    status,
    category,
    ruleId: "test",
    ruleVersion: "1",
    requirementId: "r",
    title: status,
    summary: status,
    technicalReason: status,
    sourceValue: null,
    targetValue: null,
    confidence: "HIGH",
    remediationType: "NONE",
    registryEvidence: {},
  };
}

describe("scoring and readiness", () => {
  it("starts at 100 when there are no findings", () => {
    const scored = scoreFindings([]);
    expect(scored.score).toBe(100);
    expect(scored.coverage).toBe(100);
    expect(
      determineReadiness({
        blockerCount: scored.counts.blocker,
        warningCount: scored.counts.warning,
        unknownCount: scored.counts.unknown,
        coverage: scored.coverage,
      }),
    ).toBe("READY");
  });

  it("uses PASS=1, WARNING=0.70, BLOCKER=0 and ignores UNKNOWN in the numerator", () => {
    const scored = scoreFindings([
      finding("PASS", "TOKENS"),
      finding("WARNING", "TOKENS"),
      finding("UNKNOWN", "TOKENS"),
    ]);
    expect(scored.coverage).toBe(67);
    expect(scored.categories.find((item) => item.category === "TOKENS")?.score).toBe(0.85);
    expect(scored.score).toBe(85);
  });

  it("does not penalize a project without cross-chain requirements", () => {
    const withBridge = scoreFindings([finding("PASS", "TOKENS"), finding("PASS", "CROSS_CHAIN")]);
    const withoutBridge = scoreFindings([finding("PASS", "TOKENS")]);
    expect(withBridge.score).toBe(100);
    expect(withoutBridge.score).toBe(100);
    expect(
      withoutBridge.categories.find((item) => item.category === "CROSS_CHAIN")?.applicable,
    ).toBe(false);
  });

  it("does not treat all-UNKNOWN as a perfect score", () => {
    const scored = scoreFindings([finding("UNKNOWN", "ORACLES"), finding("UNKNOWN", "TOKENS")]);
    expect(scored.score).toBe(0);
    expect(scored.coverage).toBe(0);
    expect(scored.coverageConfidence).toBe("LOW");
    expect(
      determineReadiness({
        blockerCount: scored.counts.blocker,
        warningCount: scored.counts.warning,
        unknownCount: scored.counts.unknown,
        coverage: scored.coverage,
      }),
    ).toBe("INSUFFICIENT_DATA");
  });

  it("keeps a high score from hiding blockers", () => {
    const scored = scoreFindings([
      finding("PASS", "TOKENS"),
      finding("PASS", "ORACLES"),
      finding("PASS", "PROTOCOLS"),
      finding("PASS", "CROSS_CHAIN"),
      finding("PASS", "CONTRACTS"),
      finding("PASS", "FRONTEND"),
      finding("BLOCKER", "RPC"),
    ]);
    expect(scored.score).toBeGreaterThan(70);
    expect(
      determineReadiness({
        blockerCount: scored.counts.blocker,
        warningCount: scored.counts.warning,
        unknownCount: scored.counts.unknown,
        coverage: scored.coverage,
      }),
    ).toBe("BLOCKED");
  });

  it("marks warnings as review required when there are no blockers", () => {
    const scored = scoreFindings([finding("WARNING", "CONFIGURATION"), finding("PASS", "TOKENS")]);
    expect(
      determineReadiness({
        blockerCount: scored.counts.blocker,
        warningCount: scored.counts.warning,
        unknownCount: scored.counts.unknown,
        coverage: scored.coverage,
      }),
    ).toBe("REVIEW_REQUIRED");
  });

  it("splits frontend/configuration weight 15 when both apply", () => {
    const scored = scoreFindings([finding("PASS", "FRONTEND"), finding("PASS", "CONFIGURATION")]);
    const frontend = scored.categories.find((item) => item.category === "FRONTEND");
    const configuration = scored.categories.find((item) => item.category === "CONFIGURATION");
    expect(frontend?.weight).toBe(53.33);
    expect(configuration?.weight).toBe(46.67);
  });
});
