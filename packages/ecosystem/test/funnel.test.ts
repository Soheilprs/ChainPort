import { describe, expect, it } from "vitest";

import { conversionRate, cumulativeFunnel, formatRate, highestStage } from "../src/funnel.js";

describe("funnel math", () => {
  it("counts a project once at every stage up to its highest reached stage", () => {
    const counts = cumulativeFunnel(["PROJECT_STARTED", "VALIDATION_PASSED", "VALIDATION_PASSED"]);
    expect(counts.PROJECT_STARTED).toBe(3);
    expect(counts.REPOSITORY_ANALYZED).toBe(2);
    expect(counts.VALIDATION_PASSED).toBe(2);
    expect(counts.TESTNET_DEPLOYED).toBe(0);
  });

  it("returns N/A rather than 0% when the denominator is zero", () => {
    expect(conversionRate(0, 0)).toBeNull();
    expect(formatRate(null)).toBe("N/A");
    expect(conversionRate(1, 4)).toBe(0.25);
  });

  it("ranks deployed above prepared", () => {
    expect(
      highestStage({
        ingested: true,
        analyzed: true,
        compatibilityEvaluated: true,
        migrationPlanned: true,
        safeFixesGenerated: true,
        revisionFinalized: true,
        validationPassed: true,
        deploymentPrepared: true,
        testnetDeployed: true,
      }),
    ).toBe("TESTNET_DEPLOYED");
    expect(
      highestStage({
        ingested: true,
        analyzed: false,
        compatibilityEvaluated: false,
        migrationPlanned: false,
        safeFixesGenerated: false,
        revisionFinalized: false,
        validationPassed: false,
        deploymentPrepared: false,
        testnetDeployed: false,
      }),
    ).toBe("REPOSITORY_INGESTED");
  });
});
