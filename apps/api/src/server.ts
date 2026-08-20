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
  DeploymentRepository,
  PartnerRepository,
  IdentityRepository,
} from "@chainport/db";
import { EcosystemAnalytics } from "@chainport/ecosystem";
import { DockerSandboxRunner } from "@chainport/sandbox";
import { loadServiceConfig } from "@chainport/shared";
import { Redis } from "ioredis";

import { AnalysisService } from "./analysis-service.js";
import { CompatibilityService } from "./compatibility-service.js";
import { ChangeSetService } from "./changeset-service.js";
import { ValidationService } from "./validation-service.js";
import { DeploymentService } from "./deployment-service.js";
import { NetworkService } from "./network-service.js";
import { PublicPartnerService } from "./public-partners-service.js";
import { PlanService } from "./plan-service.js";
import { createApiApplication } from "./app.js";
import { createLogger } from "./logger.js";
import { ProjectsService } from "./projects-service.js";
import { AuthService } from "./auth-service.js";
import { AccessControl } from "./access.js";
import { RateLimiter } from "./rate-limit.js";
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
  const partners = new PartnerRepository(database);
  const identities = new IdentityRepository(database);
  const authService = new AuthService(identities, config);
  const access = new AccessControl(ingest, partners);
  const rateLimiter = new RateLimiter(redis);
  const projectsService = new ProjectsService(ingest, queue, partners);
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
  const deploymentService = new DeploymentService(
    changeSetRepository,
    planRepository,
    new ValidationRepository(database),
    new DeploymentRepository(database),
    queue,
    new DockerSandboxRunner(),
    {
      memoryBytes: config.DEPLOYMENT_MEMORY_BYTES,
      cpus: config.DEPLOYMENT_CPUS,
      pids: config.DEPLOYMENT_PIDS,
      maxTxCount: config.MAX_DEPLOYMENT_TX_COUNT,
      maxGas: config.MAX_DEPLOYMENT_GAS,
    },
  );
  const networkService = new NetworkService(partners, new EcosystemAnalytics(database));
  const publicPartnerService = new PublicPartnerService(partners, projectsService);

  const app = await createApiApplication({
    logger,
    webOrigin: config.WEB_ORIGIN,
    config,
    authService,
    access,
    rateLimiter,
    projectsService,
    analysisService,
    compatibilityService,
    planService,
    changeSetService,
    validationService,
    deploymentService,
    networkService,
    publicPartnerService,
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
