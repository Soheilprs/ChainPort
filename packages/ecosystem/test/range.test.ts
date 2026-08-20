import { describe, expect, it } from "vitest";

import { parseAnalyticsRange } from "../src/range.js";

describe("analytics time range", () => {
  it("computes UTC windows from presets without mixing clocks", () => {
    const now = new Date("2026-08-20T12:00:00.000Z");
    const week = parseAnalyticsRange({ range: "7d", now });
    expect(week.from?.toISOString()).toBe("2026-08-13T12:00:00.000Z");
    expect(week.to?.toISOString()).toBe("2026-08-20T12:00:00.000Z");
    expect(parseAnalyticsRange({ range: "all" }).from).toBeNull();
  });

  it("accepts explicit ISO bounds", () => {
    const range = parseAnalyticsRange({
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-02-01T00:00:00.000Z",
    });
    expect(range.from?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(range.to?.toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });
});
