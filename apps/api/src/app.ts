import { randomUUID } from "node:crypto";

import {
  CURRENT_PHASE,
  CURRENT_PHASE_NAME,
  CSRF_HEADER_NAME,
  PRODUCT_NAME,
  PRODUCT_QUESTION,
  PRODUCT_TAGLINE,
  SESSION_COOKIE_NAME,
} from "@chainport/shared";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import type { Logger } from "pino";

import { ApiRequestError } from "./errors.js";
import type { AnalysisService } from "./analysis-service.js";
import type { CompatibilityService } from "./compatibility-service.js";
import type { ChangeSetService } from "./changeset-service.js";
import type { PlanService } from "./plan-service.js";
import type { ValidationService } from "./validation-service.js";
import type { DeploymentService } from "./deployment-service.js";
import type { NetworkService } from "./network-service.js";
import { registerAnalysisRoutes } from "./routes/analyses.js";
import { registerChangeSetRoutes } from "./routes/change-sets.js";
import { registerChainRoutes } from "./routes/chains.js";
import { registerCompatibilityRoutes } from "./routes/compatibility.js";
import { registerJobRoutes } from "./routes/jobs.js";
import { registerPlanRoutes } from "./routes/plans.js";
import { registerValidationRoutes } from "./routes/validations.js";
import { registerDeploymentRoutes } from "./routes/deployments.js";
import { registerNetworkRoutes } from "./routes/network.js";
import { registerPublicPartnerRoutes } from "./routes/public-partners.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerAuthRoutes } from "./routes/auth.js";
import type { PublicPartnerService } from "./public-partners-service.js";
import type { ProjectsService } from "./projects-service.js";
import type { AuthService } from "./auth-service.js";
import type { AccessControl } from "./access.js";
import type { RateLimiter } from "./rate-limit.js";
import { metrics } from "./metrics.js";
import type { ServiceConfig } from "@chainport/shared";

export type ReadinessProbe = () => Promise<void>;

export interface ApiApplicationOptions {
  logger: Logger;
  readinessProbe: ReadinessProbe;
  webOrigin: string;
  config?: ServiceConfig;
  authService?: AuthService;
  access?: AccessControl;
  rateLimiter?: RateLimiter;
  projectsService?: ProjectsService;
  analysisService?: AnalysisService;
  compatibilityService?: CompatibilityService;
  planService?: PlanService;
  changeSetService?: ChangeSetService;
  validationService?: ValidationService;
  deploymentService?: DeploymentService;
  networkService?: NetworkService;
  publicPartnerService?: PublicPartnerService;
}

const PUBLIC_PREFIXES = [
  "/health",
  "/ready",
  "/metrics",
  "/v1/meta",
  "/v1/chains",
  "/v1/public/partners",
  "/v1/auth/test/login",
  "/v1/auth/oidc/start",
  "/v1/auth/oidc/callback",
  "/v1/deployment-targets",
];

export async function createApiApplication(options: ApiApplicationOptions) {
  const app = Fastify({
    loggerInstance: options.logger,
    disableRequestLogging: false,
    bodyLimit: 262_144,
    maxParamLength: 200,
    genReqId: () => randomUUID(),
  });

  await app.register(cookie);
  await app.register(cors, {
    origin: options.webOrigin,
    credentials: true,
    maxAge: 600,
  });

  app.addHook("onRequest", async (request, reply) => {
    request.requestId = request.id;
    const started = Date.now();
    reply.header("x-request-id", request.id);
    request.raw.on("close", () => {
      metrics.observeDuration(Date.now() - started);
      metrics.increment("chainport_api_requests_total", {
        method: request.method,
        status: String(reply.statusCode),
      });
    });
  });

  app.addHook("preHandler", async (request, reply) => {
    if (options.authService === undefined) {
      return;
    }
    const token = bearerOrCookie(request);
    request.actor = await options.authService.actorFromToken(token);
    if (isPublicPath(request.method, request.url)) {
      if (options.rateLimiter !== undefined && request.url.startsWith("/v1/public/")) {
        await options.rateLimiter.consume(
          `public:${request.ip}`,
          options.config?.RATE_LIMIT_PUBLIC_PER_MINUTE ?? 60,
          60,
        );
      }
      return;
    }
    if (request.actor === undefined) {
      throw new ApiRequestError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
    }
    if (isMutating(request.method) && token !== undefined && !hasBearer(request)) {
      await options.authService.verifyCsrf(token, headerValue(request.headers[CSRF_HEADER_NAME]));
    }
    if (options.rateLimiter !== undefined) {
      const limit = request.url.startsWith("/v1/auth/")
        ? (options.config?.RATE_LIMIT_AUTH_PER_MINUTE ?? 20)
        : (options.config?.RATE_LIMIT_MUTATION_PER_MINUTE ?? 30);
      await options.rateLimiter.consume(
        `user:${request.actor.userId}:${request.method}`,
        limit,
        60,
      );
    }
    void reply;
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

  app.get("/metrics", async (_request, reply) => {
    return reply.type("text/plain").send(metrics.renderPrometheus());
  });

  app.get("/v1/meta", () => ({
    data: {
      name: PRODUCT_NAME,
      tagline: PRODUCT_TAGLINE,
      question: PRODUCT_QUESTION,
      phase: CURRENT_PHASE,
      phaseName: CURRENT_PHASE_NAME,
      auth: {
        provider: options.config?.AUTH_PROVIDER ?? "test",
      },
      flags: {
        validation: options.config?.ENABLE_VALIDATION !== false,
        testnetDeployment: options.config?.ENABLE_TESTNET_DEPLOYMENT !== false,
        privateRepos: options.config?.ENABLE_PRIVATE_REPOS !== false,
      },
    },
  }));

  if (options.authService !== undefined) {
    registerAuthRoutes(app, options.authService);
  }
  registerChainRoutes(app);
  if (options.projectsService !== undefined && options.access !== undefined) {
    registerProjectRoutes(app, options.projectsService, options.access);
    registerJobRoutes(app, options.projectsService, options.access);
  } else if (options.projectsService !== undefined) {
    registerProjectRoutes(app, options.projectsService);
    registerJobRoutes(app, options.projectsService);
  }
  if (options.analysisService !== undefined) {
    registerAnalysisRoutes(app, options.analysisService, options.access);
  }
  if (options.compatibilityService !== undefined) {
    registerCompatibilityRoutes(app, options.compatibilityService, options.access);
  }
  if (options.planService !== undefined) {
    registerPlanRoutes(app, options.planService, options.access);
  }
  if (options.changeSetService !== undefined) {
    registerChangeSetRoutes(app, options.changeSetService, options.access);
  }
  if (options.validationService !== undefined) {
    registerValidationRoutes(app, options.validationService, options.access, options.config);
  }
  if (options.deploymentService !== undefined) {
    registerDeploymentRoutes(app, options.deploymentService, options.access, options.config);
  }
  if (options.networkService !== undefined) {
    registerNetworkRoutes(app, options.networkService, options.access);
  }
  if (options.publicPartnerService !== undefined && options.projectsService !== undefined) {
    registerPublicPartnerRoutes(
      app,
      options.publicPartnerService,
      options.projectsService,
      options.access,
    );
  }

  app.setNotFoundHandler(async (_request, reply) => {
    await reply.status(404).send({
      status: "error",
      code: "ROUTE_NOT_FOUND",
      message: "Route not found",
      requestId: _request.id,
    });
  });

  app.setErrorHandler(async (error, request, reply) => {
    if (error instanceof ApiRequestError) {
      request.log.info({ code: error.code, requestId: request.id }, "API request rejected");
      if (error.retryAfterSeconds !== undefined) {
        reply.header("retry-after", String(error.retryAfterSeconds));
      }
      await reply.status(error.statusCode).send({
        status: "error",
        code: error.code,
        message: error.message,
        requestId: request.id,
      });
      return;
    }
    request.log.error({ err: error, requestId: request.id }, "Unhandled API request error");
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
      requestId: request.id,
    });
  });

  return app;
}

function isPublicPath(method: string, url: string): boolean {
  const path = url.split("?")[0] ?? url;
  if (method === "POST" && path.match(/^\/v1\/public\/partners\/[^/]+\/projects$/) !== null) {
    return false;
  }
  return PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function isMutating(method: string): boolean {
  return method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE";
}

function bearerOrCookie(request: {
  headers: { authorization?: string | undefined };
  cookies?: Record<string, string | undefined>;
}): string | undefined {
  const bearer = request.headers.authorization;
  if (typeof bearer === "string" && bearer.startsWith("Bearer ")) {
    return bearer.slice(7);
  }
  return request.cookies?.[SESSION_COOKIE_NAME];
}

function hasBearer(request: { headers: { authorization?: string | undefined } }): boolean {
  return (
    typeof request.headers.authorization === "string" &&
    request.headers.authorization.startsWith("Bearer ")
  );
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
