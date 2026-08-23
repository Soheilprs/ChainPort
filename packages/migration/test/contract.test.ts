import { describe, expect, it } from "vitest";

import { MIGRATION_IMPLEMENTATION_STATUS, MIGRATION_RULESET_VERSION } from "../src/index.js";

describe("migration contract", () => {
  it("is implemented for phase 5", () => {
    expect(MIGRATION_IMPLEMENTATION_STATUS).toBe("implemented");
    expect(MIGRATION_RULESET_VERSION).toBe("2");
  });
});
