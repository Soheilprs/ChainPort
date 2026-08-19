import { describe, expect, it } from "vitest";

import { isDeterministicIngestError, isRetryableIngestError } from "../src/index.js";

describe("ingest error classification", () => {
  it("treats missing and private repositories as deterministic", () => {
    expect(isDeterministicIngestError("INVALID_REPOSITORY_URL")).toBe(true);
    expect(isDeterministicIngestError("REPOSITORY_NOT_FOUND")).toBe(true);
    expect(isDeterministicIngestError("REPOSITORY_PRIVATE")).toBe(true);
    expect(isRetryableIngestError("REPOSITORY_NOT_FOUND")).toBe(false);
  });

  it("allows retries for transient clone failures", () => {
    expect(isRetryableIngestError("CLONE_TIMEOUT")).toBe(true);
    expect(isRetryableIngestError("CLONE_FAILED")).toBe(true);
    expect(isDeterministicIngestError("CLONE_TIMEOUT")).toBe(false);
  });
});
