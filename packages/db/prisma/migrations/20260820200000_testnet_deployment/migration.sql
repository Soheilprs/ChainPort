CREATE TYPE "DeploymentRunStatus" AS ENUM ('QUEUED', 'CHECKING_ELIGIBILITY', 'PREPARING', 'FUNDING', 'SIMULATING', 'PREPARED', 'BROADCASTING', 'CONFIRMING', 'VERIFYING', 'COMPLETED', 'FAILED', 'RECONCILIATION_REQUIRED', 'CANCELLED');
CREATE TYPE "DeploymentProfile" AS ENUM ('TESTNET_DEPLOY');
CREATE TYPE "DeploymentFramework" AS ENUM ('FOUNDRY', 'HARDHAT');
CREATE TYPE "DeploymentPreflightStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'SKIPPED');
CREATE TYPE "DeploymentTransactionStatus" AS ENUM ('SUBMITTED', 'PENDING', 'CONFIRMED', 'REVERTED', 'UNKNOWN');
CREATE TYPE "DeploymentSourceVerificationStatus" AS ENUM ('VERIFIED', 'FAILED', 'NOT_SUPPORTED', 'NOT_CONFIGURED', 'SKIPPED');
CREATE TYPE "DeploymentCheckStatus" AS ENUM ('PASSED', 'FAILED', 'SKIPPED');
CREATE TYPE "DeploymentCandidateConfidence" AS ENUM ('DETECTED', 'LIKELY', 'UNKNOWN');

CREATE TABLE "deployment_candidates" (
    "id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "framework" "DeploymentFramework" NOT NULL,
    "file_path" TEXT NOT NULL,
    "entrypoint" TEXT NOT NULL,
    "confidence" "DeploymentCandidateConfidence" NOT NULL,
    "evidence" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deployment_candidates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deployment_runs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "repository_revision_id" UUID NOT NULL,
    "planned_migration_id" UUID,
    "change_set_id" UUID,
    "validation_run_id" UUID NOT NULL,
    "deployment_candidate_id" UUID,
    "target_testnet_key" TEXT NOT NULL,
    "target_chain_id" INTEGER NOT NULL,
    "target_name" TEXT NOT NULL,
    "revision_content_hash" TEXT NOT NULL,
    "engine_version" TEXT NOT NULL,
    "profile" "DeploymentProfile" NOT NULL,
    "framework" "DeploymentFramework",
    "status" "DeploymentRunStatus" NOT NULL DEFAULT 'QUEUED',
    "deployer_address" TEXT,
    "sandbox_image" TEXT,
    "sandbox_image_digest" TEXT,
    "transaction_count" INTEGER,
    "estimated_gas" TEXT,
    "estimated_cost" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "limits_json" JSONB NOT NULL,
    "network_policy" TEXT NOT NULL,
    "rpc_audit_json" JSONB NOT NULL DEFAULT '{}',
    "broadcast_started_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "deployment_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deployment_status_events" (
    "id" UUID NOT NULL,
    "deployment_run_id" UUID NOT NULL,
    "from_status" "DeploymentRunStatus",
    "to_status" "DeploymentRunStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deployment_status_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deployment_preflights" (
    "id" UUID NOT NULL,
    "deployment_run_id" UUID NOT NULL,
    "transaction_count" INTEGER,
    "estimated_gas" TEXT,
    "estimated_cost" TEXT,
    "status" "DeploymentPreflightStatus" NOT NULL,
    "warnings" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deployment_preflights_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deployment_transactions" (
    "id" UUID NOT NULL,
    "deployment_run_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "nonce" INTEGER,
    "from_address" TEXT,
    "to_address" TEXT,
    "value" TEXT NOT NULL DEFAULT '0',
    "gas_limit" TEXT,
    "status" "DeploymentTransactionStatus" NOT NULL,
    "block_number" INTEGER,
    "contract_address" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMPTZ(3),

    CONSTRAINT "deployment_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deployment_contracts" (
    "id" UUID NOT NULL,
    "deployment_run_id" UUID NOT NULL,
    "address" TEXT NOT NULL,
    "transaction_hash" TEXT NOT NULL,
    "block_number" INTEGER,
    "deployer" TEXT,
    "contract_name" TEXT,
    "source_path" TEXT,
    "bytecode_present" BOOLEAN NOT NULL DEFAULT false,
    "receipt_status" TEXT,
    "verification_status" "DeploymentSourceVerificationStatus" NOT NULL,
    "verification_message" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deployment_contracts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deployment_checks" (
    "id" UUID NOT NULL,
    "deployment_run_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "DeploymentCheckStatus" NOT NULL,
    "detail" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deployment_checks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "deployment_candidates_revision_id_framework_file_path_entrypoint_key" ON "deployment_candidates"("revision_id", "framework", "file_path", "entrypoint");
CREATE INDEX "deployment_candidates_revision_id_idx" ON "deployment_candidates"("revision_id");
CREATE UNIQUE INDEX "deployment_runs_idempotency_key_key" ON "deployment_runs"("idempotency_key");
CREATE INDEX "deployment_runs_project_id_created_at_idx" ON "deployment_runs"("project_id", "created_at");
CREATE INDEX "deployment_runs_repository_revision_id_created_at_idx" ON "deployment_runs"("repository_revision_id", "created_at");
CREATE INDEX "deployment_runs_status_created_at_idx" ON "deployment_runs"("status", "created_at");
CREATE INDEX "deployment_runs_target_testnet_key_idx" ON "deployment_runs"("target_testnet_key");
CREATE INDEX "deployment_status_events_deployment_run_id_created_at_idx" ON "deployment_status_events"("deployment_run_id", "created_at");
CREATE UNIQUE INDEX "deployment_preflights_deployment_run_id_key" ON "deployment_preflights"("deployment_run_id");
CREATE UNIQUE INDEX "deployment_transactions_deployment_run_id_hash_key" ON "deployment_transactions"("deployment_run_id", "hash");
CREATE INDEX "deployment_transactions_deployment_run_id_sequence_idx" ON "deployment_transactions"("deployment_run_id", "sequence");
CREATE UNIQUE INDEX "deployment_contracts_deployment_run_id_address_key" ON "deployment_contracts"("deployment_run_id", "address");
CREATE INDEX "deployment_contracts_deployment_run_id_idx" ON "deployment_contracts"("deployment_run_id");
CREATE INDEX "deployment_checks_deployment_run_id_idx" ON "deployment_checks"("deployment_run_id");

ALTER TABLE "deployment_candidates" ADD CONSTRAINT "deployment_candidates_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "repository_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deployment_runs" ADD CONSTRAINT "deployment_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deployment_runs" ADD CONSTRAINT "deployment_runs_repository_revision_id_fkey" FOREIGN KEY ("repository_revision_id") REFERENCES "repository_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deployment_runs" ADD CONSTRAINT "deployment_runs_planned_migration_id_fkey" FOREIGN KEY ("planned_migration_id") REFERENCES "planned_migrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deployment_runs" ADD CONSTRAINT "deployment_runs_change_set_id_fkey" FOREIGN KEY ("change_set_id") REFERENCES "change_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deployment_runs" ADD CONSTRAINT "deployment_runs_validation_run_id_fkey" FOREIGN KEY ("validation_run_id") REFERENCES "validation_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deployment_runs" ADD CONSTRAINT "deployment_runs_deployment_candidate_id_fkey" FOREIGN KEY ("deployment_candidate_id") REFERENCES "deployment_candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deployment_status_events" ADD CONSTRAINT "deployment_status_events_deployment_run_id_fkey" FOREIGN KEY ("deployment_run_id") REFERENCES "deployment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deployment_preflights" ADD CONSTRAINT "deployment_preflights_deployment_run_id_fkey" FOREIGN KEY ("deployment_run_id") REFERENCES "deployment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deployment_transactions" ADD CONSTRAINT "deployment_transactions_deployment_run_id_fkey" FOREIGN KEY ("deployment_run_id") REFERENCES "deployment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deployment_contracts" ADD CONSTRAINT "deployment_contracts_deployment_run_id_fkey" FOREIGN KEY ("deployment_run_id") REFERENCES "deployment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deployment_checks" ADD CONSTRAINT "deployment_checks_deployment_run_id_fkey" FOREIGN KEY ("deployment_run_id") REFERENCES "deployment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
