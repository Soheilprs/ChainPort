export const QUEUE_NAMES = {
  MIGRATION_JOBS: "migration-jobs",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const JOB_NAMES = {
  INGEST_REPOSITORY: "ingest-repository",
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
