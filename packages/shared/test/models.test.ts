import { describe, expect, it } from "vitest";

import { hasBlockers, summarizeFindings } from "../src/index.js";

describe("finding summaries", () => {
  it("counts severities without inventing findings", () => {
    expect(summarizeFindings([])).toEqual({ pass: 0, warning: 0, blocker: 0 });
    expect(
      summarizeFindings([
        { severity: "PASS" },
        { severity: "WARNING" },
        { severity: "WARNING" },
        { severity: "BLOCKER" },
      ]),
    ).toEqual({ pass: 1, warning: 2, blocker: 1 });
  });

  it("treats only BLOCKER as blocking", () => {
    expect(hasBlockers([{ severity: "WARNING" }])).toBe(false);
    expect(hasBlockers([{ severity: "BLOCKER" }])).toBe(true);
  });
});
