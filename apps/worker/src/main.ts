import { FileSystemArtifactStore } from "@chainport/changeset";
import {
  AnalysisRepository,
  ChangeSetRepository,
  checkDatabase,
  disconnectDatabase,
  getDatabaseClient,
  IngestRepository,
  PlanRepository,
  ValidationRepository,
  DeploymentRepository,
} from "@chainport/db";
import { WorkspaceManager } from "@chainport/ingest";
import { DockerSandboxRunner } from "@chainport/sandbox";
import { createId, loadServiceConfig } from "@chainport/shared";
import { Redis } from "ioredis";

import { createGitHubMetadataClient } from "./ingest-processor.js";
import { createLogger } from "./logger.js";
import { startWorkerRuntime } from "./runtime.js";

export async function runWorker(): Promise<void> {
  const config = loadServiceConfig();
  const workerId = config.WORKER_ID ?? createId();
  const logger = createLogger({ service: "worker", level: config.LOG_LEVEL });
  const database = getDatabaseClient();
  await checkDatabase(database);

  const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
  await redis.connect();

  const workspaces = new WorkspaceManager(config.WORKSPACE_ROOT ?? WorkspaceManager.defaultRoot());
  const artifacts = new FileSystemArtifactStore(
    config.ARTIFACT_ROOT ?? FileSystemArtifactStore.defaultRoot(),
  );
  const ingest = new IngestRepository(database);
  const analyses = new AnalysisRepository(database);
  const plans = new PlanRepository(database);
  const changeSets = new ChangeSetRepository(database);
  const validations = new ValidationRepository(database);
  const deployments = new DeploymentRepository(database);
  const sandbox = new DockerSandboxRunner();

  const runtime = await startWorkerRuntime({
    workerId,
    redis,
    logger,
    processor: {
      ingest,
      workspaces,
      metadata: createGitHubMetadataClient(config),
      config,
      logger,
      workerId,
    },
    analysisProcessor: {
      ingest,
      analyses,
      workspaces,
      config,
      logger,
    },
    changeSetProcessor: {
      ingest,
      plans,
      changeSets,
      workspaces,
      artifacts,
      config,
      logger,
    },
    validationProcessor: {
      ingest,
      revisions: changeSets,
      validations,
      workspaces,
      artifacts,
      sandbox,
      config,
      logger,
    },
    deploymentProcessor: {
      ingest,
      revisions: changeSets,
      plans,
      validations,
      deployments,
      workspaces,
      artifacts,
      sandbox,
      config,
      logger,
    },
  });

  await new Promise<void>((resolve) => {
    let shuttingDown = false;
    const shutdown = (signal: NodeJS.Signals): void => {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;
      void runtime
        .stop(signal)
        .then(async () => {
          await disconnectDatabase(database);
          resolve();
        })
        .catch((error: unknown) => {
          logger.error({ err: error, workerId }, "Worker shutdown failed");
          resolve();
        });
    };
    process.on("SIGINT", () => {
      shutdown("SIGINT");
    });
    process.on("SIGTERM", () => {
      shutdown("SIGTERM");
    });
  });
}

const entrypoint = process.argv[1];
const isDirectRun =
  entrypoint !== undefined && (entrypoint.endsWith("main.ts") || entrypoint.endsWith("main.js"));

if (isDirectRun) {
  void runWorker().catch((error: unknown) => {
    const logger = createLogger({ service: "worker", level: "info" });
    logger.fatal({ err: error }, "Worker failed to start");
    process.exitCode = 1;
  });
}
