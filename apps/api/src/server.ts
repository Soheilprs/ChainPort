import {
  AnalysisRepository,
  checkDatabase,
  CompatibilityRepository,
  disconnectDatabase,
  getDatabaseClient,
  IngestRepository,
  ChangeSetRepository,
  PlanRepository,
  ValidationRepository,
} from "@chainport/db";
import { DockerSandboxRunner } from "@chainport/sandbox";
import { loadServiceConfig } from "@chainport/shared";
import { Redis } from "ioredis";

import { AnalysisService } from "./analysis-service.js";
import { CompatibilityService } from "./compatibility-service.js";
import { ChangeSetService } from "./changeset-service.js";
import { ValidationService } from "./validation-service.js";
import { PlanService } from "./plan-service.js";
import { createApiApplication } from "./app.js";
import { createLogger } from "./logger.js";
import { ProjectsService } from "./projects-service.js";
import { createIngestJobQueue } from "./queue.js";
import { checkRedis } from "./redis.js";

async function main(): Promise<void> {
  const config = loadServiceConfig();
  const logger = createLogger({ service: "api", level: config.LOG_LEVEL });
  const database = getDatabaseClient();
  const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
  await redis.connect();

  const queue = createIngestJobQueue(redis);
  const ingest = new IngestRepository(database);
  const projectsService = new ProjectsService(ingest, queue);
  const analyses = new AnalysisRepository(database);
  const analysisService = new AnalysisService(ingest, analyses, queue);
  const compatibility = new CompatibilityRepository(database);
  const compatibilityService = new CompatibilityService(ingest, analyses, compatibility);
  const planRepository = new PlanRepository(database);
  const planService = new PlanService(compatibility, planRepository);
  const changeSetRepository = new ChangeSetRepository(database);
  const changeSetService = new ChangeSetService(planRepository, changeSetRepository, queue);
  const validationService = new ValidationService(
    changeSetRepository,
    new ValidationRepository(database),
    queue,
    new DockerSandboxRunner(),
    {
      ...(config.SANDBOX_IMAGE_FOUNDRY === undefined
        ? {}
        : { foundry: config.SANDBOX_IMAGE_FOUNDRY }),
      ...(config.SANDBOX_IMAGE_NODE20 === undefined ? {} : { node20: config.SANDBOX_IMAGE_NODE20 }),
      ...(config.SANDBOX_IMAGE_NODE22 === undefined ? {} : { node22: config.SANDBOX_IMAGE_NODE22 }),
    },
    {
      memoryBytes: config.VALIDATION_MEMORY_BYTES,
      cpus: config.VALIDATION_CPUS,
      pids: config.VALIDATION_PIDS,
    },
  );

  const app = await createApiApplication({
    logger,
    webOrigin: config.WEB_ORIGIN,
    projectsService,
    analysisService,
    compatibilityService,
    planService,
    changeSetService,
    validationService,
    readinessProbe: async () => {
      await checkDatabase(database);
      await checkRedis(redis);
    },
  });

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, "API shutdown started");
    await app.close();
    await queue.close();
    await redis.quit();
    await disconnectDatabase(database);
    logger.info("API shutdown complete");
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await app.listen({ host: config.API_HOST, port: config.API_PORT });
  logger.info({ host: config.API_HOST, port: config.API_PORT }, "API started");
}

void main().catch((error: unknown) => {
  const logger = createLogger({ service: "api", level: "info" });
  logger.fatal({ err: error }, "API failed to start");
  process.exitCode = 1;
});
