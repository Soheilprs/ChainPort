import { JOB_NAMES, QUEUE_NAMES } from "@chainport/shared";
import { describe, expect, it } from "vitest";

describe("worker ingest registration", () => {
  it("registers the ingest processor on the migration queue", () => {
    expect(QUEUE_NAMES.MIGRATION_JOBS).toBe("migration-jobs");
    expect(JOB_NAMES.INGEST_REPOSITORY).toBe("ingest-repository");
    expect(JOB_NAMES.ANALYZE_REPOSITORY).toBe("analyze-repository");
  });
});
