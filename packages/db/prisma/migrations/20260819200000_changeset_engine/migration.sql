CREATE TYPE "ChangeSetStatus" AS ENUM ('QUEUED', 'MATERIALIZING', 'GENERATING', 'READY_FOR_REVIEW', 'FINALIZING', 'FINALIZED', 'FAILED', 'ROLLED_BACK');
CREATE TYPE "ChangeStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'REJECTED', 'SKIPPED', 'FAILED');
CREATE TYPE "ChangeType" AS ENUM ('REPLACE_VALUE');
CREATE TYPE "RevisionType" AS ENUM ('ORIGINAL', 'GENERATED');
CREATE TYPE "RevisionCompleteness" AS ENUM ('COMPLETE', 'PARTIAL');

ALTER TABLE "projects" ADD COLUMN "active_revision_id" UUID;
CREATE INDEX "projects_active_revision_id_idx" ON "projects"("active_revision_id");

CREATE TABLE "repository_revisions" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "repository_id" UUID NOT NULL,
    "base_revision_id" UUID,
    "base_commit_sha" TEXT NOT NULL,
    "type" "RevisionType" NOT NULL,
    "change_set_id" UUID,
    "content_hash" TEXT NOT NULL,
    "completeness" "RevisionCompleteness",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "repository_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "repository_revisions_change_set_id_key" ON "repository_revisions"("change_set_id");
CREATE INDEX "repository_revisions_repository_id_base_commit_sha_idx" ON "repository_revisions"("repository_id", "base_commit_sha");
CREATE INDEX "repository_revisions_project_id_created_at_idx" ON "repository_revisions"("project_id", "created_at");
CREATE INDEX "repository_revisions_content_hash_idx" ON "repository_revisions"("content_hash");

CREATE TABLE "change_sets" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "migration_plan_id" UUID NOT NULL,
    "repository_id" UUID NOT NULL,
    "original_revision_id" UUID NOT NULL,
    "base_commit_sha" TEXT NOT NULL,
    "engine_version" TEXT NOT NULL,
    "status" "ChangeSetStatus" NOT NULL DEFAULT 'QUEUED',
    "completeness" "RevisionCompleteness",
    "total_changes" INTEGER NOT NULL DEFAULT 0,
    "proposed_count" INTEGER NOT NULL DEFAULT 0,
    "accepted_count" INTEGER NOT NULL DEFAULT 0,
    "rejected_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "idempotency_key" TEXT NOT NULL,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalized_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "change_sets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "change_sets_idempotency_key_key" ON "change_sets"("idempotency_key");
CREATE INDEX "change_sets_migration_plan_id_created_at_idx" ON "change_sets"("migration_plan_id", "created_at");
CREATE INDEX "change_sets_repository_id_status_idx" ON "change_sets"("repository_id", "status");
CREATE INDEX "change_sets_project_id_created_at_idx" ON "change_sets"("project_id", "created_at");

CREATE TABLE "change_set_status_events" (
    "id" UUID NOT NULL,
    "change_set_id" UUID NOT NULL,
    "from_status" "ChangeSetStatus",
    "to_status" "ChangeSetStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "change_set_status_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "change_set_status_events_change_set_id_created_at_idx" ON "change_set_status_events"("change_set_id", "created_at");

CREATE TABLE "change_set_changes" (
    "id" UUID NOT NULL,
    "change_set_id" UUID NOT NULL,
    "migration_action_id" UUID,
    "file_path" TEXT NOT NULL,
    "patcher_id" TEXT,
    "patcher_version" TEXT,
    "change_type" "ChangeType",
    "status" "ChangeStatus" NOT NULL,
    "skip_reason" TEXT,
    "source_hash" TEXT,
    "result_hash" TEXT,
    "before_excerpt" TEXT,
    "after_excerpt" TEXT,
    "unified_diff" TEXT,
    "patched_text" TEXT,
    "source_value" TEXT,
    "target_value" TEXT,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "change_set_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "change_set_changes_change_set_id_status_idx" ON "change_set_changes"("change_set_id", "status");
CREATE INDEX "change_set_changes_migration_action_id_idx" ON "change_set_changes"("migration_action_id");

ALTER TABLE "repository_revisions" ADD CONSTRAINT "repository_revisions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "repository_revisions" ADD CONSTRAINT "repository_revisions_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "repository_revisions" ADD CONSTRAINT "repository_revisions_base_revision_id_fkey" FOREIGN KEY ("base_revision_id") REFERENCES "repository_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "change_sets" ADD CONSTRAINT "change_sets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "change_sets" ADD CONSTRAINT "change_sets_migration_plan_id_fkey" FOREIGN KEY ("migration_plan_id") REFERENCES "planned_migrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "change_sets" ADD CONSTRAINT "change_sets_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "change_sets" ADD CONSTRAINT "change_sets_original_revision_id_fkey" FOREIGN KEY ("original_revision_id") REFERENCES "repository_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "repository_revisions" ADD CONSTRAINT "repository_revisions_change_set_id_fkey" FOREIGN KEY ("change_set_id") REFERENCES "change_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_active_revision_id_fkey" FOREIGN KEY ("active_revision_id") REFERENCES "repository_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "change_set_status_events" ADD CONSTRAINT "change_set_status_events_change_set_id_fkey" FOREIGN KEY ("change_set_id") REFERENCES "change_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "change_set_changes" ADD CONSTRAINT "change_set_changes_change_set_id_fkey" FOREIGN KEY ("change_set_id") REFERENCES "change_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "change_set_changes" ADD CONSTRAINT "change_set_changes_migration_action_id_fkey" FOREIGN KEY ("migration_action_id") REFERENCES "planned_migration_actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
