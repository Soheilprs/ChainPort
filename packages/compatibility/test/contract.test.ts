import { describe, expect, it } from "vitest";

import { assertCompatibilityAvailable, COMPATIBILITY_IMPLEMENTATION_STATUS } from "../src/index.js";

describe("compatibility contract", () => {
  it("is explicitly unimplemented in phase 1", () => {
    expect(COMPATIBILITY_IMPLEMENTATION_STATUS).toBe("not_implemented");
    expect(() => assertCompatibilityAvailable()).toThrow(/not implemented in phase 1/);
  });
});
