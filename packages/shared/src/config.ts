import { z } from "zod";

import {
  AUTH_PROVIDERS,
  DATABASE_PURPOSES,
  type AuthProviderName,
  type DatabasePurpose,
} from "./enums.js";
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

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

const nodeEnvironmentSchema = z.enum(["development", "test", "production"]);
const logLevelSchema = z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]);
const databasePurposeSchema = z.enum(DATABASE_PURPOSES);
const authProviderSchema = z.enum(AUTH_PROVIDERS);
const artifactStoreSchema = z.enum(["filesystem", "s3"]);

const optionalNonEmptyString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const booleanFromEnv = z.preprocess((value) => {
  if (value === undefined || value === "") {
    return undefined;
  }
  if (value === true || value === false) {
    return value;
  }
  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }
  return value;
}, z.boolean().optional());

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
  ARTIFACT_ROOT: optionalNonEmptyString,
  ARTIFACT_STORE: artifactStoreSchema.default("filesystem"),
  S3_BUCKET: optionalNonEmptyString,
  S3_ENDPOINT: optionalNonEmptyString,
  S3_REGION: optionalNonEmptyString,
  S3_ACCESS_KEY_ID: optionalNonEmptyString,
  S3_SECRET_ACCESS_KEY: optionalNonEmptyString,
  AUTH_PROVIDER: authProviderSchema.default("test"),
  SESSION_SECRET: optionalNonEmptyString,
  SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(2_592_000).default(43_200),
  OIDC_ISSUER: optionalNonEmptyString,
  OIDC_CLIENT_ID: optionalNonEmptyString,
  OIDC_CLIENT_SECRET: optionalNonEmptyString,
  OIDC_REDIRECT_URI: optionalNonEmptyString,
  GITHUB_APP_ID: optionalNonEmptyString,
  GITHUB_APP_PRIVATE_KEY: optionalNonEmptyString,
  GITHUB_APP_CLIENT_ID: optionalNonEmptyString,
  GITHUB_APP_CLIENT_SECRET: optionalNonEmptyString,
  ENABLE_VALIDATION: booleanFromEnv.default(true),
  ENABLE_TESTNET_DEPLOYMENT: booleanFromEnv.default(true),
  ENABLE_PRIVATE_REPOS: booleanFromEnv.default(true),
  ARTIFACT_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
  VALIDATION_LOG_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(30),
  FAILED_WORKSPACE_RETENTION_HOURS: z.coerce.number().int().min(1).max(168).default(1),
  RATE_LIMIT_PUBLIC_PER_MINUTE: z.coerce.number().int().min(1).max(10_000).default(60),
  RATE_LIMIT_AUTH_PER_MINUTE: z.coerce.number().int().min(1).max(1_000).default(20),
  RATE_LIMIT_MUTATION_PER_MINUTE: z.coerce.number().int().min(1).max(1_000).default(30),
  MAX_CONCURRENT_INGEST_PER_USER: z.coerce.number().int().min(1).max(50).default(2),
  MAX_CONCURRENT_ANALYSIS_PER_USER: z.coerce.number().int().min(1).max(50).default(2),
  MAX_CONCURRENT_VALIDATION_PER_USER: z.coerce.number().int().min(1).max(20).default(1),
  MAX_CONCURRENT_DEPLOYMENT_PER_USER: z.coerce.number().int().min(1).max(20).default(1),
  CLONE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(600_000).default(60_000),
  CLONE_MAX_BYTES: z.coerce.number().int().min(1_024).max(5_368_709_120).default(104_857_600),
  ANALYSIS_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(600_000).default(120_000),
  ANALYSIS_MAX_FILES: z.coerce.number().int().min(1).max(100_000).default(8_000),
  ANALYSIS_MAX_FILE_BYTES: z.coerce.number().int().min(1_024).max(10_485_760).default(524_288),
  ANALYSIS_MAX_TOTAL_BYTES: z.coerce.number().int().min(1_024).max(524_288_000).default(20_971_520),
  ANALYSIS_MAX_DEPTH: z.coerce.number().int().min(1).max(64).default(20),
  VALIDATION_INSTALL_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(600_000).default(180_000),
  VALIDATION_BUILD_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(600_000).default(180_000),
  VALIDATION_TEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(600_000).default(180_000),
  VALIDATION_TOTAL_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(1_800_000).default(600_000),
  VALIDATION_MEMORY_BYTES: z.coerce
    .number()
    .int()
    .min(64 * 1024 * 1024)
    .max(16 * 1024 * 1024 * 1024)
    .default(2 * 1024 * 1024 * 1024),
  VALIDATION_CPUS: z.coerce.number().min(0.1).max(16).default(2),
  VALIDATION_PIDS: z.coerce.number().int().min(16).max(10_000).default(256),
  VALIDATION_LOG_STEP_BYTES: z.coerce.number().int().min(1_024).max(10_485_760).default(262_144),
  VALIDATION_LOG_TOTAL_BYTES: z.coerce.number().int().min(1_024).max(20_971_520).default(1_048_576),
  DEPLOYMENT_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(1_800_000).default(300_000),
  DEPLOYMENT_MEMORY_BYTES: z.coerce
    .number()
    .int()
    .min(64 * 1024 * 1024)
    .max(16 * 1024 * 1024 * 1024)
    .default(2 * 1024 * 1024 * 1024),
  DEPLOYMENT_CPUS: z.coerce.number().min(0.1).max(16).default(2),
  DEPLOYMENT_PIDS: z.coerce.number().int().min(16).max(10_000).default(256),
  MAX_DEPLOYMENT_TX_COUNT: z.coerce.number().int().min(1).max(100).default(12),
  MAX_DEPLOYMENT_GAS: z.coerce.number().int().min(21_000).max(500_000_000).default(15_000_000),
  MAX_TESTNET_FUNDING_WEI: z.preprocess(
    (value) => (value === undefined || value === "" ? "50000000000000000" : value),
    z.coerce.bigint().min(0n).max(10_000_000_000_000_000_000n),
  ),
  MAX_TRANSACTION_VALUE_WEI: z.preprocess(
    (value) => (value === undefined || value === "" ? "0" : value),
    z.coerce.bigint().min(0n).max(10_000_000_000_000_000_000n),
  ),
  RPC_PROXY_MAX_BODY_BYTES: z.coerce.number().int().min(1_024).max(10_485_760).default(1_048_576),
  RPC_PROXY_RATE_LIMIT: z.coerce.number().int().min(1).max(10_000).default(120),
  RPC_PROXY_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
  ETHERSCAN_API_KEY: optionalNonEmptyString,
  CHAINPORT_TESTNET_FUNDER_PRIVATE_KEY: optionalNonEmptyString,
  SANDBOX_IMAGE_FOUNDRY: optionalNonEmptyString,
  SANDBOX_IMAGE_NODE20: optionalNonEmptyString,
  SANDBOX_IMAGE_NODE22: optionalNonEmptyString,
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
  const parsed = unwrapConfig(serviceEnvironmentSchema.safeParse(environment));
  if (parsed.NODE_ENV === "production") {
    assertProductionSafety(parsed);
  }
  return parsed;
}

export function loadWebConfig(environment: NodeJS.ProcessEnv = process.env): WebConfig {
  const parsed = unwrapConfig(webEnvironmentSchema.safeParse(environment));
  if (parsed.NODE_ENV === "production") {
    const api = parsed.NEXT_PUBLIC_API_URL;
    if (!isHttpsUrl(api) && !api.startsWith("/")) {
      throw new ConfigurationError(
        "Invalid ChainPort configuration: production NEXT_PUBLIC_API_URL must be HTTPS",
      );
    }
  }
  return parsed;
}

export function resolveDatabasePurpose(config: ServiceConfig): DatabasePurpose | undefined {
  return config.CHAINPORT_DB_PURPOSE;
}

export function requireSessionSecret(config: ServiceConfig): string {
  if (config.SESSION_SECRET !== undefined && config.SESSION_SECRET.length >= 32) {
    return config.SESSION_SECRET;
  }
  if (config.NODE_ENV === "production") {
    throw new ConfigurationError("SESSION_SECRET must be at least 32 characters in production");
  }
  return "chainport-dev-session-secret-not-for-production";
}

const DEFAULT_CREDENTIAL_MARKERS = [
  "chainport:chainport",
  "password=chainport",
  "postgres:postgres",
];

export function assertProductionSafety(config: ServiceConfig): void {
  const problems: string[] = [];
  if (config.AUTH_PROVIDER === "test") {
    problems.push("AUTH_PROVIDER=test is forbidden in production");
  }
  if (config.AUTH_PROVIDER === "oidc") {
    if (config.OIDC_ISSUER === undefined || !isHttpsUrl(config.OIDC_ISSUER)) {
      problems.push("OIDC_ISSUER must be an HTTPS URL in production");
    }
    if (config.OIDC_CLIENT_ID === undefined) {
      problems.push("OIDC_CLIENT_ID is required in production");
    }
    if (config.OIDC_CLIENT_SECRET === undefined) {
      problems.push("OIDC_CLIENT_SECRET is required in production");
    }
    if (config.OIDC_REDIRECT_URI === undefined || !isHttpsUrl(config.OIDC_REDIRECT_URI)) {
      problems.push("OIDC_REDIRECT_URI must be an HTTPS URL in production");
    }
  }
  if (config.SESSION_SECRET === undefined || config.SESSION_SECRET.length < 32) {
    problems.push("SESSION_SECRET must be at least 32 characters in production");
  }
  if (
    config.CHAINPORT_DB_PURPOSE === undefined ||
    config.CHAINPORT_DB_PURPOSE === "development" ||
    config.CHAINPORT_DB_PURPOSE === "integration-test"
  ) {
    problems.push("CHAINPORT_DB_PURPOSE must be staging or production");
  }
  try {
    const web = new URL(config.WEB_ORIGIN);
    if (web.protocol !== "https:" || web.hostname === "localhost" || web.hostname === "127.0.0.1") {
      problems.push("WEB_ORIGIN must be a public HTTPS origin in production");
    }
  } catch {
    problems.push("WEB_ORIGIN is invalid");
  }
  if (config.ARTIFACT_STORE !== "s3") {
    problems.push("ARTIFACT_STORE must be s3 in production");
  }
  if (config.S3_BUCKET === undefined) {
    problems.push("S3_BUCKET is required when ARTIFACT_STORE=s3");
  }
  if (config.S3_ACCESS_KEY_ID === undefined || config.S3_SECRET_ACCESS_KEY === undefined) {
    problems.push("S3 credentials are required in production");
  }
  const database = config.DATABASE_URL.toLowerCase();
  if (DEFAULT_CREDENTIAL_MARKERS.some((marker) => database.includes(marker))) {
    problems.push("DATABASE_URL uses default sample credentials");
  }
  if (database.includes("localhost") || database.includes("127.0.0.1")) {
    problems.push("DATABASE_URL must not target localhost in production");
  }
  if (config.ENABLE_PRIVATE_REPOS === true) {
    if (config.GITHUB_APP_ID === undefined || config.GITHUB_APP_PRIVATE_KEY === undefined) {
      problems.push("GitHub App configuration is required when ENABLE_PRIVATE_REPOS=true");
    }
  }
  if (problems.length > 0) {
    throw new ConfigurationError(`Invalid ChainPort configuration: ${problems.join("; ")}`);
  }
}

export function isSecretEnvKey(key: string): boolean {
  const upper = key.toUpperCase();
  return (
    upper.includes("SECRET") ||
    upper.includes("PASSWORD") ||
    upper.includes("PRIVATE_KEY") ||
    upper.includes("ACCESS_KEY") ||
    upper === "DATABASE_URL" ||
    upper === "REDIS_URL" ||
    upper === "ETHERSCAN_API_KEY" ||
    upper === "CHAINPORT_TESTNET_FUNDER_PRIVATE_KEY"
  );
}

export type { AuthProviderName };
