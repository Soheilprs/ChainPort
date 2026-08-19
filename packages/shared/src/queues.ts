export const QUEUE_NAMES = {
  MIGRATION_JOBS: "migration-jobs",
  ANALYSIS_JOBS: "analysis-jobs",
  CHANGESET_JOBS: "changeset-jobs",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const JOB_NAMES = {
  INGEST_REPOSITORY: "ingest-repository",
  ANALYZE_REPOSITORY: "analyze-repository",
  GENERATE_CHANGESET: "generate-changeset",
  FINALIZE_CHANGESET: "finalize-changeset",
  RUN_MIGRATION: "run-migration",
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

export interface MigrationJobPayload {
  jobId: string;
  projectId: string;
  attempt: number;
}

export interface IngestJobPayload {
  jobId: string;
}

export interface AnalysisJobPayload {
  analysisId: string;
}

export interface ChangeSetJobPayload {
  changeSetId: string;
}
