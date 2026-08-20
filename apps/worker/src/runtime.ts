import {
  JOB_NAMES,
  QUEUE_NAMES,
  type AnalysisJobPayload,
  type ChangeSetJobPayload,
  type DeploymentJobPayload,
  type IngestJobPayload,
  type ValidationJobPayload,
} from "@chainport/shared";
import { Worker, type Job } from "bullmq";
import type { Redis } from "ioredis";
import type { Logger } from "pino";

import { processAnalysisJob, type AnalysisProcessorDependencies } from "./analysis-processor.js";
import {
  processFinalizeChangeSet,
  processGenerateChangeSet,
  type ChangeSetProcessorDependencies,
} from "./changeset-processor.js";
import { processIngestJob, type IngestProcessorDependencies } from "./ingest-processor.js";
import {
  processValidationJob,
  type ValidationProcessorDependencies,
} from "./validation-processor.js";
import {
  processBroadcastDeployment,
  processPrepareDeployment,
  processReconcileDeployment,
  type DeploymentProcessorDependencies,
} from "./deployment-processor.js";

export interface WorkerRuntimeOptions {
  workerId: string;
  redis: Redis;
  logger: Logger;
  processor: IngestProcessorDependencies;
  analysisProcessor: AnalysisProcessorDependencies;
  changeSetProcessor: ChangeSetProcessorDependencies;
  validationProcessor: ValidationProcessorDependencies;
  deploymentProcessor: DeploymentProcessorDependencies;
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
  const changeSetWorker = new Worker<ChangeSetJobPayload>(
    QUEUE_NAMES.CHANGESET_JOBS,
    async (job: Job<ChangeSetJobPayload>) => {
      if (job.name === JOB_NAMES.FINALIZE_CHANGESET) {
        await processFinalizeChangeSet(job.data.changeSetId, options.changeSetProcessor);
        return;
      }
      await processGenerateChangeSet(job.data.changeSetId, options.changeSetProcessor);
    },
    { connection: options.redis, concurrency: 1 },
  );
  const validationWorker = new Worker<ValidationJobPayload>(
    QUEUE_NAMES.VALIDATION_JOBS,
    async (job: Job<ValidationJobPayload>) => {
      await processValidationJob(job.data.validationId, options.validationProcessor);
    },
    { connection: options.redis, concurrency: 1 },
  );
  const deploymentWorker = new Worker<DeploymentJobPayload>(
    QUEUE_NAMES.DEPLOYMENT_JOBS,
    async (job: Job<DeploymentJobPayload>) => {
      if (job.name === JOB_NAMES.BROADCAST_DEPLOYMENT) {
        await processBroadcastDeployment(job.data.deploymentId, options.deploymentProcessor);
        return;
      }
      if (job.name === JOB_NAMES.RECONCILE_DEPLOYMENT) {
        await processReconcileDeployment(job.data.deploymentId, options.deploymentProcessor);
        return;
      }
      await processPrepareDeployment(job.data.deploymentId, options.deploymentProcessor);
    },
    { connection: options.redis, concurrency: 1 },
  );

  ingestWorker.on("failed", (job, error) => {
    options.logger.error({ err: error, jobId: job?.data.jobId }, "ingest job failed");
  });
  analysisWorker.on("failed", (job, error) => {
    options.logger.error({ err: error, analysisId: job?.data.analysisId }, "analysis job failed");
  });
  changeSetWorker.on("failed", (job, error) => {
    options.logger.error(
      { err: error, changeSetId: job?.data.changeSetId },
      "changeset job failed",
    );
  });
  validationWorker.on("failed", (job, error) => {
    options.logger.error(
      { err: error, validationId: job?.data.validationId },
      "validation job failed",
    );
  });
  deploymentWorker.on("failed", (job, error) => {
    options.logger.error(
      { err: error, deploymentId: job?.data.deploymentId, name: job?.name },
      "deployment job failed",
    );
  });

  options.logger.info(
    {
      workerId: options.workerId,
      queues: [
        QUEUE_NAMES.MIGRATION_JOBS,
        QUEUE_NAMES.ANALYSIS_JOBS,
        QUEUE_NAMES.CHANGESET_JOBS,
        QUEUE_NAMES.VALIDATION_JOBS,
        QUEUE_NAMES.DEPLOYMENT_JOBS,
      ],
      processors: [
        JOB_NAMES.INGEST_REPOSITORY,
        JOB_NAMES.ANALYZE_REPOSITORY,
        JOB_NAMES.GENERATE_CHANGESET,
        JOB_NAMES.FINALIZE_CHANGESET,
        JOB_NAMES.VALIDATE_REVISION,
        JOB_NAMES.PREPARE_DEPLOYMENT,
        JOB_NAMES.BROADCAST_DEPLOYMENT,
        JOB_NAMES.RECONCILE_DEPLOYMENT,
      ],
    },
    "Worker started; ingest, analysis, changeset, validation, and deployment processors registered",
  );

  let stopped = false;
  return {
    workerId: options.workerId,
    registeredQueues: [
      QUEUE_NAMES.MIGRATION_JOBS,
      QUEUE_NAMES.ANALYSIS_JOBS,
      QUEUE_NAMES.CHANGESET_JOBS,
      QUEUE_NAMES.VALIDATION_JOBS,
      QUEUE_NAMES.DEPLOYMENT_JOBS,
    ],
    registeredProcessors: [
      JOB_NAMES.INGEST_REPOSITORY,
      JOB_NAMES.ANALYZE_REPOSITORY,
      JOB_NAMES.GENERATE_CHANGESET,
      JOB_NAMES.FINALIZE_CHANGESET,
      JOB_NAMES.VALIDATE_REVISION,
      JOB_NAMES.PREPARE_DEPLOYMENT,
      JOB_NAMES.BROADCAST_DEPLOYMENT,
      JOB_NAMES.RECONCILE_DEPLOYMENT,
    ],
    async stop(signal) {
      if (stopped) {
        return;
      }
      stopped = true;
      options.logger.info({ workerId: options.workerId, signal }, "Worker shutdown started");
      await ingestWorker.close();
      await analysisWorker.close();
      await changeSetWorker.close();
      await validationWorker.close();
      await deploymentWorker.close();
      await options.redis.quit();
      options.logger.info({ workerId: options.workerId }, "Worker shutdown complete");
    },
  };
}
