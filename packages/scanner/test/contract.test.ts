import { describe, expect, it } from "vitest";

import { assertScannerAvailable, SCANNER_IMPLEMENTATION_STATUS } from "../src/index.js";

describe("scanner contract", () => {
  it("is explicitly unimplemented in phase 1", () => {
    expect(SCANNER_IMPLEMENTATION_STATUS).toBe("not_implemented");
    expect(() => assertScannerAvailable()).toThrow(/not implemented in phase 1/);
  });
});
