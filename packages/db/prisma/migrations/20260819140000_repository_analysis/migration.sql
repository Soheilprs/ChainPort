CREATE TYPE "AnalysisStatus" AS ENUM ('QUEUED', 'MATERIALIZING', 'INVENTORYING', 'ANALYZING', 'COMPLETED', 'FAILED');
CREATE TYPE "FileCategory" AS ENUM ('SOLIDITY', 'TYPESCRIPT', 'JAVASCRIPT', 'JSON', 'TOML', 'YAML', 'MARKDOWN', 'ENV_TEMPLATE', 'CONFIG', 'OTHER');
CREATE TYPE "RequirementCategory" AS ENUM ('NETWORK', 'TOKEN', 'ORACLE', 'PROTOCOL', 'CROSS_CHAIN', 'RPC', 'FRONTEND', 'CONFIGURATION', 'FRAMEWORK');
CREATE TYPE "DetectionConfidence" AS ENUM ('DETECTED', 'LIKELY', 'UNKNOWN');
CREATE TYPE "ComponentKind" AS ENUM ('FRAMEWORK', 'LANGUAGE', 'PACKAGE_MANAGER', 'CONTRACT', 'INTERFACE', 'LIBRARY', 'FRONTEND', 'DEPENDENCY');
CREATE TYPE "DetectorRunStatus" AS ENUM ('COMPLETED', 'FAILED');

CREATE TABLE "repository_analyses" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "repository_id" UUID NOT NULL,
    "commit_sha" TEXT NOT NULL,
    "scanner_version" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotency_key" TEXT NOT NULL,
    "file_count" INTEGER NOT NULL DEFAULT 0,
    "analyzed_file_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_file_count" INTEGER NOT NULL DEFAULT 0,
    "total_analyzed_bytes" INTEGER NOT NULL DEFAULT 0,
    "error_code" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "repository_analyses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "analysis_status_events" (
    "id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "from_status" "AnalysisStatus",
    "to_status" "AnalysisStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "analysis_status_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "analysis_detector_runs" (
    "id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "detector_id" TEXT NOT NULL,
    "detector_version" TEXT NOT NULL,
    "status" "DetectorRunStatus" NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "analysis_detector_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "repository_files" (
    "id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "category" "FileCategory" NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "analyzed" BOOLEAN NOT NULL,
    "skip_reason" TEXT,
    CONSTRAINT "repository_files_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "repository_components" (
    "id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "kind" "ComponentKind" NOT NULL,
    "name" TEXT NOT NULL,
    "detail" TEXT,
    "file_path" TEXT,
    CONSTRAINT "repository_components_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_requirements" (
    "id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "category" "RequirementCategory" NOT NULL,
    "key" TEXT NOT NULL,
    "requirement_type" TEXT NOT NULL,
    "detected_value" TEXT NOT NULL,
    "normalized_value" TEXT NOT NULL,
    "confidence" "DetectionConfidence" NOT NULL,
    "detector" TEXT NOT NULL,
    "detector_version" TEXT NOT NULL,
    CONSTRAINT "project_requirements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "analysis_evidence" (
    "id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "requirement_id" UUID,
    "file_path" TEXT NOT NULL,
    "start_line" INTEGER NOT NULL,
    "end_line" INTEGER NOT NULL,
    "evidence_type" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    CONSTRAINT "analysis_evidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "repository_analyses_idempotency_key_key" ON "repository_analyses"("idempotency_key");
CREATE UNIQUE INDEX "repository_analyses_repository_id_commit_sha_scanner_version_key" ON "repository_analyses"("repository_id", "commit_sha", "scanner_version");
CREATE INDEX "repository_analyses_project_id_created_at_idx" ON "repository_analyses"("project_id", "created_at");
CREATE INDEX "repository_analyses_status_created_at_idx" ON "repository_analyses"("status", "created_at");
CREATE INDEX "analysis_status_events_analysis_id_created_at_idx" ON "analysis_status_events"("analysis_id", "created_at");
CREATE INDEX "analysis_detector_runs_analysis_id_idx" ON "analysis_detector_runs"("analysis_id");
CREATE INDEX "repository_files_analysis_id_category_idx" ON "repository_files"("analysis_id", "category");
CREATE INDEX "repository_components_analysis_id_kind_idx" ON "repository_components"("analysis_id", "kind");
CREATE INDEX "project_requirements_analysis_id_category_idx" ON "project_requirements"("analysis_id", "category");
CREATE INDEX "project_requirements_analysis_id_key_idx" ON "project_requirements"("analysis_id", "key");
CREATE INDEX "analysis_evidence_analysis_id_idx" ON "analysis_evidence"("analysis_id");
CREATE INDEX "analysis_evidence_requirement_id_idx" ON "analysis_evidence"("requirement_id");

ALTER TABLE "repository_analyses" ADD CONSTRAINT "repository_analyses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "repository_analyses" ADD CONSTRAINT "repository_analyses_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "analysis_status_events" ADD CONSTRAINT "analysis_status_events_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "repository_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analysis_detector_runs" ADD CONSTRAINT "analysis_detector_runs_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "repository_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "repository_files" ADD CONSTRAINT "repository_files_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "repository_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "repository_components" ADD CONSTRAINT "repository_components_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "repository_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_requirements" ADD CONSTRAINT "project_requirements_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "repository_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analysis_evidence" ADD CONSTRAINT "analysis_evidence_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "repository_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analysis_evidence" ADD CONSTRAINT "analysis_evidence_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "project_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
