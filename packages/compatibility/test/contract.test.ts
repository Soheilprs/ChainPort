import { describe, expect, it } from "vitest";

import {
  COMPATIBILITY_IMPLEMENTATION_STATUS,
  COMPATIBILITY_RULESET_VERSION,
} from "../src/index.js";

describe("compatibility contract", () => {
  it("is implemented for phase 4", () => {
    expect(COMPATIBILITY_IMPLEMENTATION_STATUS).toBe("implemented");
    expect(COMPATIBILITY_RULESET_VERSION).toBe("3");
  });
});
