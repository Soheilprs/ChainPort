CREATE TYPE "MigrationPlanRunStatus" AS ENUM ('QUEUED', 'PLANNING', 'COMPLETED', 'FAILED');
CREATE TYPE "MigrationPlanOutcome" AS ENUM ('READY_TO_APPLY', 'REVIEW_REQUIRED', 'BLOCKED', 'NEEDS_VERIFICATION');
CREATE TYPE "MigrationAutomationLevel" AS ENUM ('SAFE_AUTOMATIC', 'REVIEW_REQUIRED', 'MANUAL', 'BLOCKED', 'UNKNOWN');
CREATE TYPE "MigrationRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "MigrationActionStatus" AS ENUM ('PLANNED', 'BLOCKED', 'UNKNOWN');
CREATE TYPE "MigrationStage" AS ENUM ('NETWORK_CONFIGURATION', 'RPC_AND_EXPLORER', 'TOKEN_MAPPINGS', 'INFRASTRUCTURE_CONTRACTS', 'ORACLES', 'CROSS_CHAIN', 'CONTRACT_CONFIGURATION', 'FRONTEND_CONFIGURATION', 'DEPLOYMENT_CONFIGURATION', 'MANUAL_REVIEW');
CREATE TYPE "MigrationActionCategory" AS ENUM ('CHAIN_ID', 'RPC_URL', 'EXPLORER', 'ENV_CONFIG', 'TOKEN_ADDRESS', 'INFRASTRUCTURE_ADDRESS', 'ORACLE_FEED', 'RPC_CAPABILITY', 'CROSS_CHAIN', 'FRONTEND_NETWORK', 'UNKNOWN_ADDRESS', 'BLOCKED_INFRASTRUCTURE');

CREATE TABLE "planned_migrations" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "compatibility_run_id" UUID NOT NULL,
    "repository_id" UUID NOT NULL,
    "commit_sha" TEXT NOT NULL,
    "source_chain_key" TEXT NOT NULL,
    "target_chain_key" TEXT NOT NULL,
    "registry_snapshot_hash" TEXT NOT NULL,
    "migration_ruleset_version" TEXT NOT NULL,
    "status" "MigrationPlanRunStatus" NOT NULL DEFAULT 'QUEUED',
    "outcome" "MigrationPlanOutcome" NOT NULL,
    "migration_ready" BOOLEAN NOT NULL,
    "total_actions" INTEGER NOT NULL DEFAULT 0,
    "safe_action_count" INTEGER NOT NULL DEFAULT 0,
    "review_action_count" INTEGER NOT NULL DEFAULT 0,
    "manual_action_count" INTEGER NOT NULL DEFAULT 0,
    "blocked_action_count" INTEGER NOT NULL DEFAULT 0,
    "unknown_action_count" INTEGER NOT NULL DEFAULT 0,
    "auto_fixable_percent" INTEGER NOT NULL DEFAULT 0,
    "verification_required" BOOLEAN NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "planned_migrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "planned_migrations_idempotency_key_key" ON "planned_migrations"("idempotency_key");
CREATE UNIQUE INDEX "planned_migrations_run_ruleset_key" ON "planned_migrations"("compatibility_run_id", "migration_ruleset_version");
CREATE INDEX "planned_migrations_project_id_created_at_idx" ON "planned_migrations"("project_id", "created_at");
CREATE INDEX "planned_migrations_status_created_at_idx" ON "planned_migrations"("status", "created_at");

CREATE TABLE "planned_migration_status_events" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "from_status" "MigrationPlanRunStatus",
    "to_status" "MigrationPlanRunStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "planned_migration_status_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "planned_migration_status_events_plan_created_at_idx" ON "planned_migration_status_events"("plan_id", "created_at");

CREATE TABLE "planned_migration_actions" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "semantic_key" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "rule_version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "technical_reason" TEXT NOT NULL,
    "category" "MigrationActionCategory" NOT NULL,
    "stage" "MigrationStage" NOT NULL,
    "automation_level" "MigrationAutomationLevel" NOT NULL,
    "risk_level" "MigrationRiskLevel" NOT NULL,
    "action_status" "MigrationActionStatus" NOT NULL,
    "source_value" TEXT,
    "target_value" TEXT,
    "display_order" INTEGER NOT NULL,
    "dependency_order" INTEGER NOT NULL,
    "registry_refs" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "planned_migration_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "planned_migration_actions_plan_stage_idx" ON "planned_migration_actions"("plan_id", "stage");
CREATE INDEX "planned_migration_actions_plan_automation_idx" ON "planned_migration_actions"("plan_id", "automation_level");

CREATE TABLE "planned_migration_action_evidence" (
    "id" UUID NOT NULL,
    "action_id" UUID NOT NULL,
    "finding_id" UUID,
    "evidence_id" TEXT,
    "file_path" TEXT NOT NULL,
    "start_line" INTEGER NOT NULL,
    "excerpt" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "planned_migration_action_evidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "planned_migration_action_evidence_action_id_idx" ON "planned_migration_action_evidence"("action_id");
CREATE INDEX "planned_migration_action_evidence_finding_id_idx" ON "planned_migration_action_evidence"("finding_id");

CREATE TABLE "planned_migration_action_dependencies" (
    "id" UUID NOT NULL,
    "action_id" UUID NOT NULL,
    "depends_on_action_id" UUID NOT NULL,
    CONSTRAINT "planned_migration_action_dependencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "planned_migration_action_dependencies_pair_key" ON "planned_migration_action_dependencies"("action_id", "depends_on_action_id");
CREATE INDEX "planned_migration_action_dependencies_depends_idx" ON "planned_migration_action_dependencies"("depends_on_action_id");

ALTER TABLE "planned_migrations" ADD CONSTRAINT "planned_migrations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planned_migrations" ADD CONSTRAINT "planned_migrations_compatibility_run_id_fkey" FOREIGN KEY ("compatibility_run_id") REFERENCES "compatibility_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "planned_migrations" ADD CONSTRAINT "planned_migrations_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "planned_migration_status_events" ADD CONSTRAINT "planned_migration_status_events_plan_fkey" FOREIGN KEY ("plan_id") REFERENCES "planned_migrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planned_migration_actions" ADD CONSTRAINT "planned_migration_actions_plan_fkey" FOREIGN KEY ("plan_id") REFERENCES "planned_migrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planned_migration_action_evidence" ADD CONSTRAINT "planned_migration_action_evidence_action_fkey" FOREIGN KEY ("action_id") REFERENCES "planned_migration_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planned_migration_action_evidence" ADD CONSTRAINT "planned_migration_action_evidence_finding_fkey" FOREIGN KEY ("finding_id") REFERENCES "compatibility_findings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "planned_migration_action_dependencies" ADD CONSTRAINT "planned_migration_action_dependencies_action_fkey" FOREIGN KEY ("action_id") REFERENCES "planned_migration_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planned_migration_action_dependencies" ADD CONSTRAINT "planned_migration_action_dependencies_depends_fkey" FOREIGN KEY ("depends_on_action_id") REFERENCES "planned_migration_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
