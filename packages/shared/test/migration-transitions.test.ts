import { describe, expect, it } from "vitest";

import {
  assertMigrationPlanTransition,
  buildMigrationPlanIdempotencyKey,
  InvalidMigrationPlanTransitionError,
} from "../src/index.js";

describe("migration plan transitions", () => {
  it("allows queued planning to complete and forbids rewriting completed plans", () => {
    expect(() => assertMigrationPlanTransition("QUEUED", "PLANNING")).not.toThrow();
    expect(() => assertMigrationPlanTransition("PLANNING", "COMPLETED")).not.toThrow();
    expect(() => assertMigrationPlanTransition("COMPLETED", "PLANNING")).toThrow(
      InvalidMigrationPlanTransitionError,
    );
  });

  it("builds identity from compatibility run and ruleset", () => {
    expect(
      buildMigrationPlanIdempotencyKey({
        compatibilityRunId: "run-1",
        migrationRulesetVersion: "1",
      }),
    ).toBe("plan:run-1:1");
  });
});
