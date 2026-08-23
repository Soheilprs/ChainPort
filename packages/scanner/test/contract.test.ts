import { describe, expect, it } from "vitest";

import { SCANNER_IMPLEMENTATION_STATUS, SCANNER_VERSION } from "../src/index.js";

describe("scanner contract", () => {
  it("is implemented and versioned", () => {
    expect(SCANNER_IMPLEMENTATION_STATUS).toBe("implemented");
    expect(SCANNER_VERSION).toBe("3");
  });
});
