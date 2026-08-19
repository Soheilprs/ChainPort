CREATE TYPE "ValidationRunStatus" AS ENUM ('QUEUED', 'PREPARING', 'INSTALLING', 'BUILDING', 'TESTING', 'COMPLETED', 'FAILED', 'TIMED_OUT');
CREATE TYPE "ValidationOutcome" AS ENUM ('PASSED', 'FAILED', 'PARTIAL', 'UNSUPPORTED', 'INFRA_FAILURE');
CREATE TYPE "ValidationStepName" AS ENUM ('MATERIALIZE', 'VERIFY_REVISION', 'INSTALL', 'BUILD', 'TEST', 'CLEANUP');
CREATE TYPE "ValidationStepStatus" AS ENUM ('PENDING', 'RUNNING', 'PASSED', 'FAILED', 'SKIPPED', 'TIMED_OUT');
CREATE TYPE "ValidationFramework" AS ENUM ('FOUNDRY', 'HARDHAT');
CREATE TYPE "ValidationProfile" AS ENUM ('STANDARD_LOCAL');

CREATE TABLE "validation_runs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "repository_revision_id" UUID NOT NULL,
    "revision_type" "RevisionType" NOT NULL,
    "base_commit_sha" TEXT NOT NULL,
    "revision_content_hash" TEXT NOT NULL,
    "engine_version" TEXT NOT NULL,
    "profile" "ValidationProfile" NOT NULL,
    "framework" "ValidationFramework",
    "status" "ValidationRunStatus" NOT NULL DEFAULT 'QUEUED',
    "outcome" "ValidationOutcome",
    "sandbox_image" TEXT,
    "sandbox_image_digest" TEXT,
    "runtime_version" TEXT,
    "build_status" "ValidationStepStatus",
    "test_status" "ValidationStepStatus",
    "counts_available" BOOLEAN NOT NULL DEFAULT false,
    "test_total" INTEGER,
    "test_passed" INTEGER,
    "test_failed" INTEGER,
    "test_skipped" INTEGER,
    "duration_ms" INTEGER,
    "error_code" TEXT,
    "error_message" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "limits_json" JSONB NOT NULL,
    "network_policy" TEXT NOT NULL,
    "lease_owner" TEXT,
    "lease_expires_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "validation_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "validation_runs_idempotency_key_key" ON "validation_runs"("idempotency_key");
CREATE INDEX "validation_runs_repository_revision_id_created_at_idx" ON "validation_runs"("repository_revision_id", "created_at");
CREATE INDEX "validation_runs_project_id_created_at_idx" ON "validation_runs"("project_id", "created_at");
CREATE INDEX "validation_runs_status_created_at_idx" ON "validation_runs"("status", "created_at");
CREATE INDEX "validation_runs_revision_content_hash_idx" ON "validation_runs"("revision_content_hash");

CREATE TABLE "validation_status_events" (
    "id" UUID NOT NULL,
    "validation_run_id" UUID NOT NULL,
    "from_status" "ValidationRunStatus",
    "to_status" "ValidationRunStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "validation_status_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "validation_status_events_validation_run_id_created_at_idx" ON "validation_status_events"("validation_run_id", "created_at");

CREATE TABLE "validation_steps" (
    "id" UUID NOT NULL,
    "validation_run_id" UUID NOT NULL,
    "name" "ValidationStepName" NOT NULL,
    "status" "ValidationStepStatus" NOT NULL DEFAULT 'PENDING',
    "exit_code" INTEGER,
    "duration_ms" INTEGER,
    "log_truncated" BOOLEAN NOT NULL DEFAULT false,
    "log_text" TEXT,
    "error_code" TEXT,
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    CONSTRAINT "validation_steps_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "validation_steps_validation_run_id_name_idx" ON "validation_steps"("validation_run_id", "name");

CREATE TABLE "validation_test_results" (
    "id" UUID NOT NULL,
    "validation_run_id" UUID NOT NULL,
    "suite" TEXT,
    "test_name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "duration_ms" INTEGER,
    "failure_summary" TEXT,
    CONSTRAINT "validation_test_results_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "validation_test_results_validation_run_id_idx" ON "validation_test_results"("validation_run_id");

ALTER TABLE "validation_runs" ADD CONSTRAINT "validation_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "validation_runs" ADD CONSTRAINT "validation_runs_repository_revision_id_fkey" FOREIGN KEY ("repository_revision_id") REFERENCES "repository_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "validation_status_events" ADD CONSTRAINT "validation_status_events_validation_run_id_fkey" FOREIGN KEY ("validation_run_id") REFERENCES "validation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "validation_steps" ADD CONSTRAINT "validation_steps_validation_run_id_fkey" FOREIGN KEY ("validation_run_id") REFERENCES "validation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "validation_test_results" ADD CONSTRAINT "validation_test_results_validation_run_id_fkey" FOREIGN KEY ("validation_run_id") REFERENCES "validation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
