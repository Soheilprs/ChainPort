import { z } from "zod";

import { DATABASE_PURPOSES, type DatabasePurpose } from "./enums.js";
import { ConfigurationError } from "./errors.js";

function isPostgresUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "postgresql:" || url.protocol === "postgres:";
  } catch {
    return false;
  }
}

function isRedisUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "redis:" || url.protocol === "rediss:";
  } catch {
    return false;
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const nodeEnvironmentSchema = z.enum(["development", "test", "production"]);
const logLevelSchema = z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]);
const databasePurposeSchema = z.enum(DATABASE_PURPOSES);

const optionalNonEmptyString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const serviceEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironmentSchema.default("development"),
  CHAINPORT_DB_PURPOSE: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    databasePurposeSchema.optional(),
  ),
  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL is required" })
    .trim()
    .min(1, "DATABASE_URL is required")
    .refine(isPostgresUrl, "DATABASE_URL must be a PostgreSQL connection string"),
  REDIS_URL: z
    .string({ required_error: "REDIS_URL is required" })
    .trim()
    .min(1, "REDIS_URL is required")
    .refine(isRedisUrl, "REDIS_URL must be a Redis connection string"),
  API_HOST: z.string().trim().min(1).default("0.0.0.0"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  WEB_ORIGIN: z
    .string()
    .trim()
    .default("http://localhost:3000")
    .refine(isHttpUrl, "WEB_ORIGIN must be an HTTP(S) URL"),
  LOG_LEVEL: logLevelSchema.default("info"),
  WORKER_ID: optionalNonEmptyString,
  WORKSPACE_ROOT: optionalNonEmptyString,
  CLONE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(600_000).default(60_000),
  CLONE_MAX_BYTES: z.coerce.number().int().min(1_024).max(5_368_709_120).default(104_857_600),
  ANALYSIS_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(600_000).default(120_000),
  ANALYSIS_MAX_FILES: z.coerce.number().int().min(1).max(100_000).default(8_000),
  ANALYSIS_MAX_FILE_BYTES: z.coerce.number().int().min(1_024).max(10_485_760).default(524_288),
  ANALYSIS_MAX_TOTAL_BYTES: z.coerce.number().int().min(1_024).max(524_288_000).default(20_971_520),
  ANALYSIS_MAX_DEPTH: z.coerce.number().int().min(1).max(64).default(20),
  GITHUB_API_BASE_URL: z
    .string()
    .trim()
    .default("https://api.github.com")
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname === "api.github.com";
      } catch {
        return false;
      }
    }, "GITHUB_API_BASE_URL must be https://api.github.com"),
});

const webEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironmentSchema.default("development"),
  LOG_LEVEL: logLevelSchema.default("info"),
  NEXT_PUBLIC_API_URL: z
    .string()
    .trim()
    .default("http://localhost:3001")
    .refine(isHttpUrl, "NEXT_PUBLIC_API_URL must be an HTTP(S) URL"),
});

export type ServiceConfig = z.infer<typeof serviceEnvironmentSchema>;
export type WebConfig = z.infer<typeof webEnvironmentSchema>;

function unwrapConfig<TInput, TOutput>(result: z.SafeParseReturnType<TInput, TOutput>): TOutput {
  if (!result.success) {
    const details = result.error.issues.map(
      (issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`,
    );
    throw new ConfigurationError(`Invalid ChainPort configuration: ${details.join("; ")}`);
  }
  return result.data;
}

export function loadServiceConfig(environment: NodeJS.ProcessEnv = process.env): ServiceConfig {
  return unwrapConfig(serviceEnvironmentSchema.safeParse(environment));
}

export function loadWebConfig(environment: NodeJS.ProcessEnv = process.env): WebConfig {
  return unwrapConfig(webEnvironmentSchema.safeParse(environment));
}

export function resolveDatabasePurpose(config: ServiceConfig): DatabasePurpose | undefined {
  return config.CHAINPORT_DB_PURPOSE;
}
