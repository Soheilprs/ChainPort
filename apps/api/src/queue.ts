import {
  JOB_NAMES,
  QUEUE_NAMES,
  type AnalysisJobPayload,
  type IngestJobPayload,
} from "@chainport/shared";
import { Queue } from "bullmq";
import type { Redis } from "ioredis";

export interface JobQueue {
  enqueueIngest(jobId: string): Promise<void>;
  enqueueAnalysis(analysisId: string): Promise<void>;
  close(): Promise<void>;
}

export type IngestJobQueue = JobQueue;

export function createIngestJobQueue(connection: Redis): JobQueue {
  const ingest = new Queue<IngestJobPayload>(QUEUE_NAMES.MIGRATION_JOBS, { connection });
  const analysis = new Queue<AnalysisJobPayload>(QUEUE_NAMES.ANALYSIS_JOBS, { connection });
  return {
    async enqueueIngest(jobId: string) {
      await ingest.add(
        JOB_NAMES.INGEST_REPOSITORY,
        { jobId },
        {
          jobId,
          attempts: 3,
          backoff: { type: "exponential", delay: 2_000 },
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
    },
    async enqueueAnalysis(analysisId: string) {
      await analysis.add(
        JOB_NAMES.ANALYZE_REPOSITORY,
        { analysisId },
        {
          jobId: analysisId,
          attempts: 3,
          backoff: { type: "exponential", delay: 2_000 },
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
    },
    async close() {
      await ingest.close();
      await analysis.close();
    },
  };
}
