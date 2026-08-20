export const QUEUE_NAMES = {
  MIGRATION_JOBS: "migration-jobs",
  ANALYSIS_JOBS: "analysis-jobs",
  CHANGESET_JOBS: "changeset-jobs",
  VALIDATION_JOBS: "validation-jobs",
  DEPLOYMENT_JOBS: "deployment-jobs",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const JOB_NAMES = {
  INGEST_REPOSITORY: "ingest-repository",
  ANALYZE_REPOSITORY: "analyze-repository",
  GENERATE_CHANGESET: "generate-changeset",
  FINALIZE_CHANGESET: "finalize-changeset",
  VALIDATE_REVISION: "validate-revision",
  PREPARE_DEPLOYMENT: "prepare-deployment",
  BROADCAST_DEPLOYMENT: "broadcast-deployment",
  RECONCILE_DEPLOYMENT: "reconcile-deployment",
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

export interface ValidationJobPayload {
  validationId: string;
}

export interface DeploymentJobPayload {
  deploymentId: string;
}
