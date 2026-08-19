import { describe, expect, it } from "vitest";

import {
  assertAnalysisTransition,
  buildAnalysisIdempotencyKey,
  InvalidAnalysisTransitionError,
  isAnalysisTransitionAllowed,
} from "../src/index.js";

describe("analysis transitions", () => {
  it("allows the ingest-independent analysis lifecycle", () => {
    expect(isAnalysisTransitionAllowed("QUEUED", "MATERIALIZING")).toBe(true);
    expect(isAnalysisTransitionAllowed("MATERIALIZING", "INVENTORYING")).toBe(true);
    expect(isAnalysisTransitionAllowed("INVENTORYING", "ANALYZING")).toBe(true);
    expect(isAnalysisTransitionAllowed("ANALYZING", "COMPLETED")).toBe(true);
    expect(isAnalysisTransitionAllowed("ANALYZING", "COMPARING" as never)).toBe(false);
  });

  it("rejects skipped stages", () => {
    expect(() => assertAnalysisTransition("QUEUED", "ANALYZING")).toThrow(
      InvalidAnalysisTransitionError,
    );
  });

  it("builds identity from repository, SHA, and scanner version", () => {
    expect(
      buildAnalysisIdempotencyKey({
        repositoryId: "repo-1",
        commitSha: "ABC",
        scannerVersion: "1",
      }),
    ).toBe("repo-1:abc:1");
  });
});
