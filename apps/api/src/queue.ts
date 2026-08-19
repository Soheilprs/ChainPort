import { JOB_NAMES, QUEUE_NAMES, type IngestJobPayload } from "@chainport/shared";
import { Queue } from "bullmq";
import type { Redis } from "ioredis";

export interface IngestJobQueue {
  enqueueIngest(jobId: string): Promise<void>;
  close(): Promise<void>;
}

export function createIngestJobQueue(connection: Redis): IngestJobQueue {
  const queue = new Queue<IngestJobPayload>(QUEUE_NAMES.MIGRATION_JOBS, { connection });
  return {
    async enqueueIngest(jobId: string) {
      await queue.add(
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
    async close() {
      await queue.close();
    },
  };
}
