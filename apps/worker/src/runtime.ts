import {
  JOB_NAMES,
  QUEUE_NAMES,
  type AnalysisJobPayload,
  type IngestJobPayload,
} from "@chainport/shared";
import { Worker, type Job } from "bullmq";
import type { Redis } from "ioredis";
import type { Logger } from "pino";

import { processAnalysisJob, type AnalysisProcessorDependencies } from "./analysis-processor.js";
import { processIngestJob, type IngestProcessorDependencies } from "./ingest-processor.js";

export interface WorkerRuntimeOptions {
  workerId: string;
  redis: Redis;
  logger: Logger;
  processor: IngestProcessorDependencies;
  analysisProcessor: AnalysisProcessorDependencies;
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

  const ingestWorker = new Worker<IngestJobPayload>(
    QUEUE_NAMES.MIGRATION_JOBS,
    async (job: Job<IngestJobPayload>) => {
      await processIngestJob(job.data.jobId, options.processor);
    },
    { connection: options.redis, concurrency: 1 },
  );
  const analysisWorker = new Worker<AnalysisJobPayload>(
    QUEUE_NAMES.ANALYSIS_JOBS,
    async (job: Job<AnalysisJobPayload>) => {
      await processAnalysisJob(job.data.analysisId, options.analysisProcessor);
    },
    { connection: options.redis, concurrency: 1 },
  );

  ingestWorker.on("failed", (job, error) => {
    options.logger.error({ err: error, jobId: job?.data.jobId }, "ingest job failed");
  });
  analysisWorker.on("failed", (job, error) => {
    options.logger.error({ err: error, analysisId: job?.data.analysisId }, "analysis job failed");
  });

  options.logger.info(
    {
      workerId: options.workerId,
      queues: [QUEUE_NAMES.MIGRATION_JOBS, QUEUE_NAMES.ANALYSIS_JOBS],
      processors: [JOB_NAMES.INGEST_REPOSITORY, JOB_NAMES.ANALYZE_REPOSITORY],
    },
    "Worker started; ingest and analysis processors registered",
  );

  let stopped = false;
  return {
    workerId: options.workerId,
    registeredQueues: [QUEUE_NAMES.MIGRATION_JOBS, QUEUE_NAMES.ANALYSIS_JOBS],
    registeredProcessors: [JOB_NAMES.INGEST_REPOSITORY, JOB_NAMES.ANALYZE_REPOSITORY],
    async stop(signal) {
      if (stopped) {
        return;
      }
      stopped = true;
      options.logger.info({ workerId: options.workerId, signal }, "Worker shutdown started");
      await ingestWorker.close();
      await analysisWorker.close();
      await options.redis.quit();
      options.logger.info({ workerId: options.workerId }, "Worker shutdown complete");
    },
  };
}
