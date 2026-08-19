import {
  CURRENT_PHASE,
  CURRENT_PHASE_NAME,
  PRODUCT_NAME,
  PRODUCT_QUESTION,
  PRODUCT_TAGLINE,
} from "@chainport/shared";
import cors from "@fastify/cors";
import Fastify from "fastify";
import type { Logger } from "pino";

import { ApiRequestError } from "./errors.js";
import type { AnalysisService } from "./analysis-service.js";
import type { CompatibilityService } from "./compatibility-service.js";
import type { ChangeSetService } from "./changeset-service.js";
import type { PlanService } from "./plan-service.js";
import { registerAnalysisRoutes } from "./routes/analyses.js";
import { registerChangeSetRoutes } from "./routes/change-sets.js";
import { registerChainRoutes } from "./routes/chains.js";
import { registerCompatibilityRoutes } from "./routes/compatibility.js";
import { registerJobRoutes } from "./routes/jobs.js";
import { registerPlanRoutes } from "./routes/plans.js";
import { registerProjectRoutes } from "./routes/projects.js";
import type { ProjectsService } from "./projects-service.js";

export type ReadinessProbe = () => Promise<void>;

export interface ApiApplicationOptions {
  logger: Logger;
  readinessProbe: ReadinessProbe;
  webOrigin: string;
  projectsService?: ProjectsService;
  analysisService?: AnalysisService;
  compatibilityService?: CompatibilityService;
  planService?: PlanService;
  changeSetService?: ChangeSetService;
}

export async function createApiApplication(options: ApiApplicationOptions) {
  const app = Fastify({
    loggerInstance: options.logger,
    disableRequestLogging: false,
  });

  await app.register(cors, {
    origin: options.webOrigin,
  });

  app.get("/health", () => ({
    status: "ok",
    service: "api",
    product: PRODUCT_NAME,
    phase: CURRENT_PHASE,
    timestamp: new Date().toISOString(),
  }));

  app.get("/ready", async (_request, reply) => {
    try {
      await options.readinessProbe();
      return {
        status: "ready",
        service: "api",
        product: PRODUCT_NAME,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      app.log.warn({ err: error }, "API readiness check failed");
      return reply.status(503).send({
        status: "not_ready",
        service: "api",
        product: PRODUCT_NAME,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get("/v1/meta", () => ({
    data: {
      name: PRODUCT_NAME,
      tagline: PRODUCT_TAGLINE,
      question: PRODUCT_QUESTION,
      phase: CURRENT_PHASE,
      phaseName: CURRENT_PHASE_NAME,
    },
  }));

  registerChainRoutes(app);
  if (options.projectsService !== undefined) {
    registerProjectRoutes(app, options.projectsService);
    registerJobRoutes(app, options.projectsService);
  }
  if (options.analysisService !== undefined) {
    registerAnalysisRoutes(app, options.analysisService);
  }
  if (options.compatibilityService !== undefined) {
    registerCompatibilityRoutes(app, options.compatibilityService);
  }
  if (options.planService !== undefined) {
    registerPlanRoutes(app, options.planService);
  }
  if (options.changeSetService !== undefined) {
    registerChangeSetRoutes(app, options.changeSetService);
  }

  app.setNotFoundHandler(async (_request, reply) => {
    await reply.status(404).send({
      status: "error",
      code: "ROUTE_NOT_FOUND",
      message: "Route not found",
    });
  });

  app.setErrorHandler(async (error, request, reply) => {
    if (error instanceof ApiRequestError) {
      request.log.info({ code: error.code }, "API request rejected");
      await reply.status(error.statusCode).send({
        status: "error",
        code: error.code,
        message: error.message,
      });
      return;
    }
    request.log.error({ err: error }, "Unhandled API request error");
    const possibleStatusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : undefined;
    const statusCode =
      possibleStatusCode !== undefined && possibleStatusCode < 500 ? possibleStatusCode : 500;
    await reply.status(statusCode).send({
      status: "error",
      code: statusCode === 404 ? "NOT_FOUND" : "INTERNAL_ERROR",
      message: statusCode === 500 ? "Internal server error" : "Request failed",
    });
  });

  return app;
}
