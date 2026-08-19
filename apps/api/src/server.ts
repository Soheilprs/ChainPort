import { checkDatabase, disconnectDatabase, getDatabaseClient } from "@chainport/db";
import { loadServiceConfig } from "@chainport/shared";
import { Redis } from "ioredis";

import { createApiApplication } from "./app.js";
import { createLogger } from "./logger.js";
import { checkRedis } from "./redis.js";

async function main(): Promise<void> {
  const config = loadServiceConfig();
  const logger = createLogger({ service: "api", level: config.LOG_LEVEL });
  const database = getDatabaseClient();
  const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: true });
  await redis.connect();

  const app = await createApiApplication({
    logger,
    webOrigin: config.WEB_ORIGIN,
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
