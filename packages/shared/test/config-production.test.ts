import { describe, expect, it } from "vitest";

import { ConfigurationError, assertProductionSafety, loadServiceConfig } from "../src/index.js";

const base = {
  NODE_ENV: "production",
  CHAINPORT_DB_PURPOSE: "production",
  DATABASE_URL: "postgresql://pilot:s3cret-long@db.internal/chainport",
  REDIS_URL: "rediss://redis.internal:6379",
  WEB_ORIGIN: "https://app.chainport.example",
  AUTH_PROVIDER: "oidc",
  SESSION_SECRET: "abcdefghijklmnopqrstuvwxyz012345",
  OIDC_ISSUER: "https://idp.example",
  OIDC_CLIENT_ID: "client",
  OIDC_CLIENT_SECRET: "oidc-secret",
  OIDC_REDIRECT_URI: "https://app.chainport.example/auth/callback",
  ARTIFACT_STORE: "s3",
  S3_BUCKET: "chainport-artifacts",
  S3_ACCESS_KEY_ID: "AKIA",
  S3_SECRET_ACCESS_KEY: "secret-key",
  ENABLE_PRIVATE_REPOS: "false",
} as const;

describe("production configuration", () => {
  it("accepts a complete production configuration", () => {
    const config = loadServiceConfig(base);
    expect(config.AUTH_PROVIDER).toBe("oidc");
    expect(() => assertProductionSafety(config)).not.toThrow();
  });

  it("accepts CHAINPORT_DB_PURPOSE=staging under production safety", () => {
    const config = loadServiceConfig({ ...base, CHAINPORT_DB_PURPOSE: "staging" });
    expect(config.CHAINPORT_DB_PURPOSE).toBe("staging");
    expect(() => assertProductionSafety(config)).not.toThrow();
  });

  it("rejects test identity, localhost, default credentials, and filesystem artifacts", () => {
    expect(() =>
      loadServiceConfig({
        ...base,
        AUTH_PROVIDER: "test",
      }),
    ).toThrow(ConfigurationError);
    expect(() =>
      loadServiceConfig({
        ...base,
        WEB_ORIGIN: "http://localhost:3000",
      }),
    ).toThrow(/WEB_ORIGIN/);
    expect(() =>
      loadServiceConfig({
        ...base,
        DATABASE_URL: "postgresql://chainport:chainport@localhost:5433/chainport",
        CHAINPORT_DB_PURPOSE: "development",
      }),
    ).toThrow(ConfigurationError);
    expect(() =>
      loadServiceConfig({
        ...base,
        ARTIFACT_STORE: "filesystem",
      }),
    ).toThrow(/s3/);
    expect(() =>
      loadServiceConfig({
        ...base,
        SESSION_SECRET: "short",
      }),
    ).toThrow(/SESSION_SECRET/);
    expect(() =>
      loadServiceConfig({
        ...base,
        REDIS_URL: "redis://localhost:6379",
      }),
    ).toThrow(/REDIS_URL/);
    expect(() =>
      loadServiceConfig({
        ...base,
        DATABASE_URL: "postgresql://pilot:s3cret-long@host.docker.internal/chainport",
      }),
    ).toThrow(/DATABASE_URL/);
  });
});
