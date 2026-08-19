-- CreateEnum
CREATE TYPE "OrganizationKind" AS ENUM ('NETWORK', 'FOUNDATION', 'ECOSYSTEM', 'RAAS', 'INTERNAL');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'INGESTING', 'ANALYZING', 'COMPARING', 'PLANNING', 'PATCHING', 'BUILDING', 'TESTING', 'DEPLOYING', 'VERIFYING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('PASS', 'WARNING', 'BLOCKER');

-- CreateEnum
CREATE TYPE "FindingCategory" AS ENUM ('CHAIN_ID', 'HARDCODED_ADDRESS', 'RPC', 'TOKEN', 'ORACLE', 'BRIDGE', 'PRECOMPILE', 'OPCODE', 'FRAMEWORK', 'DEPENDENCY', 'FRONTEND_CONFIG', 'PROTOCOL', 'GAS', 'FINALITY', 'INFRASTRUCTURE', 'OTHER');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "OrganizationKind" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "organization_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "name" TEXT NOT NULL,
    "github_url" TEXT NOT NULL,
    "github_owner" TEXT NOT NULL,
    "github_repo" TEXT NOT NULL,
    "default_branch" TEXT NOT NULL DEFAULT 'main',
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_jobs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "source_chain_key" TEXT NOT NULL,
    "target_chain_key" TEXT NOT NULL,
    "repo_sha" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "idempotency_key" TEXT NOT NULL,
    "lease_owner" TEXT,
    "lease_expires_at" TIMESTAMPTZ(3),
    "error_code" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "migration_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_status_events" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "from_status" "JobStatus",
    "to_status" "JobStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "category" "FindingCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "file_path" TEXT,
    "evidence" JSONB NOT NULL,
    "remediation" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_plans" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "summary" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "migration_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sandbox_runs" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "status" "JobStatus" NOT NULL,
    "image_digest" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sandbox_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployments" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "target_chain_key" TEXT NOT NULL,
    "transaction_hash" TEXT,
    "contract_address" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_github_owner_github_repo_key" ON "projects"("github_owner", "github_repo");

-- CreateIndex
CREATE INDEX "projects_organization_id_idx" ON "projects"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "migration_jobs_idempotency_key_key" ON "migration_jobs"("idempotency_key");

-- CreateIndex
CREATE INDEX "migration_jobs_status_created_at_idx" ON "migration_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "migration_jobs_project_id_idx" ON "migration_jobs"("project_id");

-- CreateIndex
CREATE INDEX "job_status_events_job_id_created_at_idx" ON "job_status_events"("job_id", "created_at");

-- CreateIndex
CREATE INDEX "findings_job_id_severity_idx" ON "findings"("job_id", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "migration_plans_job_id_key" ON "migration_plans"("job_id");

-- CreateIndex
CREATE INDEX "sandbox_runs_job_id_idx" ON "sandbox_runs"("job_id");

-- CreateIndex
CREATE INDEX "deployments_job_id_idx" ON "deployments"("job_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migration_jobs" ADD CONSTRAINT "migration_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_status_events" ADD CONSTRAINT "job_status_events_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "migration_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "migration_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migration_plans" ADD CONSTRAINT "migration_plans_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "migration_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sandbox_runs" ADD CONSTRAINT "sandbox_runs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "migration_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "migration_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
