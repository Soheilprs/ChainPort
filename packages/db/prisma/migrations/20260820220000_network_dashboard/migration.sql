CREATE TYPE "DataClassification" AS ENUM ('PRODUCTION', 'INTERNAL_TEST');
CREATE TYPE "NetworkPartnerStatus" AS ENUM ('ACTIVE', 'PAUSED', 'PILOT', 'DISABLED');

ALTER TABLE "projects" ADD COLUMN "data_classification" "DataClassification" NOT NULL DEFAULT 'PRODUCTION';

CREATE TABLE "network_partners" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "network_key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" "NetworkPartnerStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "network_partners_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "network_partners_organization_id_network_key_key" ON "network_partners"("organization_id", "network_key");
CREATE INDEX "network_partners_network_key_idx" ON "network_partners"("network_key");
CREATE INDEX "network_partners_status_idx" ON "network_partners"("status");
CREATE INDEX "projects_data_classification_created_at_idx" ON "projects"("data_classification", "created_at");
CREATE INDEX "migration_jobs_target_chain_key_created_at_idx" ON "migration_jobs"("target_chain_key", "created_at");
CREATE INDEX "compatibility_runs_target_chain_key_created_at_idx" ON "compatibility_runs"("target_chain_key", "created_at");
CREATE INDEX "compatibility_runs_target_chain_key_readiness_idx" ON "compatibility_runs"("target_chain_key", "readiness");
CREATE INDEX "compatibility_findings_rule_id_status_idx" ON "compatibility_findings"("rule_id", "status");
CREATE INDEX "planned_migrations_target_chain_key_created_at_idx" ON "planned_migrations"("target_chain_key", "created_at");
CREATE INDEX "validation_runs_outcome_created_at_idx" ON "validation_runs"("outcome", "created_at");
CREATE INDEX "deployment_runs_status_target_testnet_key_idx" ON "deployment_runs"("status", "target_testnet_key");

ALTER TABLE "network_partners" ADD CONSTRAINT "network_partners_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
