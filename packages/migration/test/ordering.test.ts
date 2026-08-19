import { describe, expect, it } from "vitest";

import { CyclicMigrationDependencyError, topologicalOrder } from "../src/index.js";
import { autoFixablePercent, determinePlanOutcome } from "../src/status.js";

describe("ordering and status", () => {
  it("rejects cyclic dependencies", () => {
    expect(() =>
      topologicalOrder(
        ["a", "b"],
        [
          { actionKey: "a", dependsOnKey: "b" },
          { actionKey: "b", dependsOnKey: "a" },
        ],
      ),
    ).toThrow(CyclicMigrationDependencyError);
  });

  it("orders acyclic dependencies", () => {
    expect(
      topologicalOrder(
        ["frontend", "network"],
        [{ actionKey: "frontend", dependsOnKey: "network" }],
      ),
    ).toEqual(["network", "frontend"]);
  });

  it("computes auto-fixable percentage excluding blocked and unknown", () => {
    expect(autoFixablePercent({ total: 10, safeAutomatic: 7, blocked: 0, unknown: 0 })).toBe(70);
    expect(autoFixablePercent({ total: 0, safeAutomatic: 0, blocked: 0, unknown: 0 })).toBe(100);
    expect(autoFixablePercent({ total: 3, safeAutomatic: 0, blocked: 2, unknown: 1 })).toBe(0);
  });

  it("maps counts to plan outcomes", () => {
    expect(
      determinePlanOutcome({ total: 1, reviewRequired: 0, manual: 0, blocked: 1, unknown: 0 }),
    ).toBe("BLOCKED");
    expect(
      determinePlanOutcome({ total: 1, reviewRequired: 0, manual: 0, blocked: 0, unknown: 1 }),
    ).toBe("NEEDS_VERIFICATION");
    expect(
      determinePlanOutcome({ total: 2, reviewRequired: 1, manual: 0, blocked: 0, unknown: 0 }),
    ).toBe("REVIEW_REQUIRED");
    expect(
      determinePlanOutcome({ total: 0, reviewRequired: 0, manual: 0, blocked: 0, unknown: 0 }),
    ).toBe("READY_TO_APPLY");
  });
});
