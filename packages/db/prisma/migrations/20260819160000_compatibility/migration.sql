CREATE TYPE "CompatibilityRunStatus" AS ENUM ('QUEUED', 'EVALUATING', 'COMPLETED', 'FAILED');
CREATE TYPE "CompatibilityFindingStatus" AS ENUM ('PASS', 'WARNING', 'BLOCKER', 'UNKNOWN');
CREATE TYPE "CompatibilityCategory" AS ENUM ('CONTRACTS', 'RPC', 'TOKENS', 'ORACLES', 'PROTOCOLS', 'CROSS_CHAIN', 'FRONTEND', 'CONFIGURATION');
CREATE TYPE "CompatibilityReadiness" AS ENUM ('READY', 'REVIEW_REQUIRED', 'BLOCKED', 'INSUFFICIENT_DATA');
CREATE TYPE "RemediationType" AS ENUM ('NONE', 'CONFIG_CHANGE', 'ADDRESS_MAPPING', 'INFRASTRUCTURE_REQUIRED', 'MANUAL_REVIEW', 'UNKNOWN');

CREATE TABLE "compatibility_registry_snapshots" (
    "id" UUID NOT NULL,
    "hash" TEXT NOT NULL,
    "registry_version" TEXT NOT NULL,
    "target_chain_key" TEXT NOT NULL,
    "canonical_json" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "compatibility_registry_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "compatibility_registry_snapshots_hash_key" ON "compatibility_registry_snapshots"("hash");

CREATE TABLE "compatibility_runs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "repository_id" UUID NOT NULL,
    "commit_sha" TEXT NOT NULL,
    "source_chain_key" TEXT NOT NULL,
    "target_chain_key" TEXT NOT NULL,
    "scanner_version" TEXT NOT NULL,
    "ruleset_version" TEXT NOT NULL,
    "registry_version" TEXT NOT NULL,
    "registry_snapshot_hash" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "coverage" INTEGER NOT NULL,
    "coverage_confidence" TEXT NOT NULL,
    "readiness" "CompatibilityReadiness" NOT NULL,
    "status" "CompatibilityRunStatus" NOT NULL DEFAULT 'QUEUED',
    "pass_count" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "blocker_count" INTEGER NOT NULL DEFAULT 0,
    "unknown_count" INTEGER NOT NULL DEFAULT 0,
    "idempotency_key" TEXT NOT NULL,
    "error_code" TEXT,
    "error_message" TEXT,
    "evaluated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "compatibility_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "compatibility_runs_idempotency_key_key" ON "compatibility_runs"("idempotency_key");
CREATE UNIQUE INDEX "compatibility_runs_identity_key" ON "compatibility_runs"("analysis_id", "target_chain_key", "ruleset_version", "registry_snapshot_hash");
CREATE INDEX "compatibility_runs_project_id_created_at_idx" ON "compatibility_runs"("project_id", "created_at");
CREATE INDEX "compatibility_runs_analysis_id_created_at_idx" ON "compatibility_runs"("analysis_id", "created_at");
CREATE INDEX "compatibility_runs_status_created_at_idx" ON "compatibility_runs"("status", "created_at");

CREATE TABLE "compatibility_status_events" (
    "id" UUID NOT NULL,
    "compatibility_run_id" UUID NOT NULL,
    "from_status" "CompatibilityRunStatus",
    "to_status" "CompatibilityRunStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "compatibility_status_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "compatibility_status_events_run_created_at_idx" ON "compatibility_status_events"("compatibility_run_id", "created_at");

CREATE TABLE "compatibility_findings" (
    "id" UUID NOT NULL,
    "compatibility_run_id" UUID NOT NULL,
    "requirement_id" UUID,
    "rule_id" TEXT NOT NULL,
    "rule_version" TEXT NOT NULL,
    "category" "CompatibilityCategory" NOT NULL,
    "status" "CompatibilityFindingStatus" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "technical_reason" TEXT NOT NULL,
    "remediation_type" "RemediationType" NOT NULL,
    "source_value" TEXT,
    "target_value" TEXT,
    "confidence" TEXT NOT NULL,
    "registry_evidence" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "compatibility_findings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "compatibility_findings_run_status_idx" ON "compatibility_findings"("compatibility_run_id", "status");
CREATE INDEX "compatibility_findings_run_category_idx" ON "compatibility_findings"("compatibility_run_id", "category");
CREATE INDEX "compatibility_findings_requirement_id_idx" ON "compatibility_findings"("requirement_id");

CREATE TABLE "compatibility_category_results" (
    "id" UUID NOT NULL,
    "compatibility_run_id" UUID NOT NULL,
    "category" "CompatibilityCategory" NOT NULL,
    "applicable" BOOLEAN NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "score" DOUBLE PRECISION,
    "pass_count" INTEGER NOT NULL,
    "warning_count" INTEGER NOT NULL,
    "blocker_count" INTEGER NOT NULL,
    "unknown_count" INTEGER NOT NULL,
    CONSTRAINT "compatibility_category_results_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "compatibility_category_results_run_category_key" ON "compatibility_category_results"("compatibility_run_id", "category");

ALTER TABLE "compatibility_runs" ADD CONSTRAINT "compatibility_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compatibility_runs" ADD CONSTRAINT "compatibility_runs_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "repository_analyses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compatibility_runs" ADD CONSTRAINT "compatibility_runs_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compatibility_runs" ADD CONSTRAINT "compatibility_runs_registry_snapshot_hash_fkey" FOREIGN KEY ("registry_snapshot_hash") REFERENCES "compatibility_registry_snapshots"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compatibility_status_events" ADD CONSTRAINT "compatibility_status_events_run_fkey" FOREIGN KEY ("compatibility_run_id") REFERENCES "compatibility_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compatibility_findings" ADD CONSTRAINT "compatibility_findings_run_fkey" FOREIGN KEY ("compatibility_run_id") REFERENCES "compatibility_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compatibility_findings" ADD CONSTRAINT "compatibility_findings_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "project_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compatibility_category_results" ADD CONSTRAINT "compatibility_category_results_run_fkey" FOREIGN KEY ("compatibility_run_id") REFERENCES "compatibility_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
