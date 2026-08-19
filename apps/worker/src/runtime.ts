import { QUEUE_NAMES } from "@chainport/shared";
import type { Logger } from "pino";

export interface RedisHealth {
  ping(): Promise<string>;
  quit(): Promise<unknown>;
}

export interface WorkerRuntimeOptions {
  workerId: string;
  redis: RedisHealth;
  logger: Logger;
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

  options.logger.info(
    {
      workerId: options.workerId,
      queues: [QUEUE_NAMES.MIGRATION_JOBS],
      processors: [],
    },
    "Worker started; migration processors are not registered in phase 1",
  );

  let stopped = false;
  return {
    workerId: options.workerId,
    registeredQueues: [QUEUE_NAMES.MIGRATION_JOBS],
    registeredProcessors: [],
    async stop(signal) {
      if (stopped) {
        return;
      }
      stopped = true;
      options.logger.info({ workerId: options.workerId, signal }, "Worker shutdown started");
      await options.redis.quit();
      options.logger.info({ workerId: options.workerId }, "Worker shutdown complete");
    },
  };
}
