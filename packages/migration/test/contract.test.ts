import { describe, expect, it } from "vitest";

import { assertMigrationAvailable, MIGRATION_IMPLEMENTATION_STATUS } from "../src/index.js";

describe("migration contract", () => {
  it("is explicitly unimplemented in phase 1", () => {
    expect(MIGRATION_IMPLEMENTATION_STATUS).toBe("not_implemented");
    expect(() => assertMigrationAvailable()).toThrow(/not implemented in phase/);
  });
});
