import { describe, expect, it } from "vitest";

import { PersistenceError, rethrowPersistenceError, UniqueConstraintError } from "../src/index.js";

describe("persistence errors", () => {
  it("does not swallow unknown errors", () => {
    expect(() => rethrowPersistenceError(new Error("disk full"))).toThrow("disk full");
    expect(new PersistenceError("database is unavailable").name).toBe("PersistenceError");
    expect(new UniqueConstraintError().name).toBe("UniqueConstraintError");
  });
});
