import { JOB_NAMES, QUEUE_NAMES } from "@chainport/shared";
import { describe, expect, it } from "vitest";

describe("worker ingest registration", () => {
  it("registers the ingest processor on the migration queue", () => {
    expect(QUEUE_NAMES.MIGRATION_JOBS).toBe("migration-jobs");
    expect(JOB_NAMES.INGEST_REPOSITORY).toBe("ingest-repository");
    expect(JOB_NAMES.ANALYZE_REPOSITORY).toBe("analyze-repository");
    expect(QUEUE_NAMES.CHANGESET_JOBS).toBe("changeset-jobs");
    expect(JOB_NAMES.GENERATE_CHANGESET).toBe("generate-changeset");
    expect(JOB_NAMES.FINALIZE_CHANGESET).toBe("finalize-changeset");
    expect(QUEUE_NAMES.VALIDATION_JOBS).toBe("validation-jobs");
    expect(JOB_NAMES.VALIDATE_REVISION).toBe("validate-revision");
    expect(QUEUE_NAMES.DEPLOYMENT_JOBS).toBe("deployment-jobs");
    expect(JOB_NAMES.PREPARE_DEPLOYMENT).toBe("prepare-deployment");
    expect(JOB_NAMES.BROADCAST_DEPLOYMENT).toBe("broadcast-deployment");
    expect(JOB_NAMES.RECONCILE_DEPLOYMENT).toBe("reconcile-deployment");
  });
});
