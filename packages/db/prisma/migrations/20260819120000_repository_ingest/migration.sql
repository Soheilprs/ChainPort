-- CreateEnum
CREATE TYPE "RepositoryProvider" AS ENUM ('GITHUB');

-- CreateEnum
CREATE TYPE "CloneStatus" AS ENUM ('PENDING', 'CLONING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "repositories" (
    "id" UUID NOT NULL,
    "provider" "RepositoryProvider" NOT NULL DEFAULT 'GITHUB',
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_url" TEXT NOT NULL,
    "default_branch" TEXT,
    "resolved_commit_sha" TEXT,
    "clone_status" "CloneStatus" NOT NULL DEFAULT 'PENDING',
    "cloned_at" TIMESTAMPTZ(3),
    "size_bytes" BIGINT,
    "ingest_error_code" TEXT,
    "ingest_error_message" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "repository_id" UUID;

-- AlterTable
ALTER TABLE "migration_jobs" ADD COLUMN "repository_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "repositories_provider_owner_name_key" ON "repositories"("provider", "owner", "name");

-- CreateIndex
CREATE UNIQUE INDEX "projects_repository_id_key" ON "projects"("repository_id");

-- CreateIndex
CREATE INDEX "migration_jobs_repository_id_idx" ON "migration_jobs"("repository_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migration_jobs" ADD CONSTRAINT "migration_jobs_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Empty catalogs: require repository identity going forward.
ALTER TABLE "projects" ALTER COLUMN "repository_id" SET NOT NULL;
ALTER TABLE "migration_jobs" ALTER COLUMN "repository_id" SET NOT NULL;
