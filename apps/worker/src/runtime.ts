import { JOB_NAMES, QUEUE_NAMES, type IngestJobPayload } from "@chainport/shared";
import { Worker, type Job } from "bullmq";
import type { Redis } from "ioredis";
import type { Logger } from "pino";

import { processIngestJob, type IngestProcessorDependencies } from "./ingest-processor.js";

export interface WorkerRuntimeOptions {
  workerId: string;
  redis: Redis;
  logger: Logger;
  processor: IngestProcessorDependencies;
}

export interface WorkerRuntime {
  workerId: string;
  registeredQueues: readonly string[];
  registeredProcessors: readonly string[];
  stop(signal?: string): Promise<void>;
}

export async function startWorkerRuntime(options: WorkerRuntimeOptions): Promise<WorkerRuntime> {
  const response = await options.redis.ping();
  if (response !== "PONG") {
    throw new Error("redis is unavailable");
  }

  const worker = new Worker<IngestJobPayload>(
    QUEUE_NAMES.MIGRATION_JOBS,
    async (job: Job<IngestJobPayload>) => {
      await processIngestJob(job.data.jobId, options.processor);
    },
    {
      connection: options.redis,
      concurrency: 1,
    },
  );

  worker.on("failed", (job, error) => {
    options.logger.error(
      { err: error, jobId: job?.data.jobId, bullmqJobName: job?.name },
      "ingest job failed",
    );
  });

  options.logger.info(
    {
      workerId: options.workerId,
      queues: [QUEUE_NAMES.MIGRATION_JOBS],
      processors: [JOB_NAMES.INGEST_REPOSITORY],
    },
    "Worker started; repository ingest processor registered",
  );

  let stopped = false;
  return {
    workerId: options.workerId,
    registeredQueues: [QUEUE_NAMES.MIGRATION_JOBS],
    registeredProcessors: [JOB_NAMES.INGEST_REPOSITORY],
    async stop(signal) {
      if (stopped) {
        return;
      }
      stopped = true;
      options.logger.info({ workerId: options.workerId, signal }, "Worker shutdown started");
      await worker.close();
      await options.redis.quit();
      options.logger.info({ workerId: options.workerId }, "Worker shutdown complete");
    },
  };
}
