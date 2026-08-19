import {
  JOB_NAMES,
  QUEUE_NAMES,
  type AnalysisJobPayload,
  type ChangeSetJobPayload,
  type IngestJobPayload,
  type ValidationJobPayload,
} from "@chainport/shared";
import { Queue } from "bullmq";
import type { Redis } from "ioredis";

export interface JobQueue {
  enqueueIngest(jobId: string): Promise<void>;
  enqueueAnalysis(analysisId: string): Promise<void>;
  enqueueGenerateChangeSet(changeSetId: string): Promise<void>;
  enqueueFinalizeChangeSet(changeSetId: string): Promise<void>;
  enqueueValidate(validationId: string): Promise<void>;
  close(): Promise<void>;
}

export type IngestJobQueue = JobQueue;

const jobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2_000 },
  removeOnComplete: 100,
  removeOnFail: 100,
};

export function createIngestJobQueue(connection: Redis): JobQueue {
  const ingest = new Queue<IngestJobPayload>(QUEUE_NAMES.MIGRATION_JOBS, { connection });
  const analysis = new Queue<AnalysisJobPayload>(QUEUE_NAMES.ANALYSIS_JOBS, { connection });
  const changeSets = new Queue<ChangeSetJobPayload>(QUEUE_NAMES.CHANGESET_JOBS, { connection });
  const validations = new Queue<ValidationJobPayload>(QUEUE_NAMES.VALIDATION_JOBS, { connection });
  return {
    async enqueueIngest(jobId: string) {
      await ingest.add(JOB_NAMES.INGEST_REPOSITORY, { jobId }, { jobId, ...jobOptions });
    },
    async enqueueAnalysis(analysisId: string) {
      await analysis.add(
        JOB_NAMES.ANALYZE_REPOSITORY,
        { analysisId },
        { jobId: analysisId, ...jobOptions },
      );
    },
    async enqueueGenerateChangeSet(changeSetId: string) {
      await changeSets.add(
        JOB_NAMES.GENERATE_CHANGESET,
        { changeSetId },
        { jobId: changeSetId, ...jobOptions },
      );
    },
    async enqueueFinalizeChangeSet(changeSetId: string) {
      await changeSets.add(
        JOB_NAMES.FINALIZE_CHANGESET,
        { changeSetId },
        { jobId: `finalize-${changeSetId}`, ...jobOptions },
      );
    },
    async enqueueValidate(validationId: string) {
      await validations.add(
        JOB_NAMES.VALIDATE_REVISION,
        { validationId },
        { jobId: validationId, ...jobOptions },
      );
    },
    async close() {
      await ingest.close();
      await analysis.close();
      await changeSets.close();
      await validations.close();
    },
  };
}
