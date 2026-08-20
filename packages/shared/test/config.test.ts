import { describe, expect, it } from "vitest";

import { ConfigurationError, loadServiceConfig, loadWebConfig } from "../src/index.js";

const validServiceEnv = {
  DATABASE_URL: "postgresql://chainport:chainport@localhost:5433/chainport",
  REDIS_URL: "redis://localhost:6379",
};

describe("loadServiceConfig", () => {
  it("loads defaults for optional fields", () => {
    const config = loadServiceConfig(validServiceEnv);
    expect(config.API_PORT).toBe(3001);
    expect(config.API_HOST).toBe("0.0.0.0");
    expect(config.WEB_ORIGIN).toBe("http://localhost:3000");
  });

  it("rejects missing or invalid connection strings", () => {
    expect(() => loadServiceConfig({})).toThrow(ConfigurationError);
    expect(() =>
      loadServiceConfig({
        ...validServiceEnv,
        DATABASE_URL: "mysql://localhost/chainport",
      }),
    ).toThrow(/PostgreSQL/);
    expect(() =>
      loadServiceConfig({
        ...validServiceEnv,
        REDIS_URL: "http://localhost:6379",
      }),
    ).toThrow(/Redis/);
  });
});

describe("loadWebConfig", () => {
  it("defaults the public API URL", () => {
    expect(loadWebConfig({}).NEXT_PUBLIC_API_URL).toBe("http://localhost:3001");
  });

  it("allows same-origin /backend routing in production and rejects localhost HTTP", () => {
    expect(
      loadWebConfig({ NODE_ENV: "production", NEXT_PUBLIC_API_URL: "/backend" })
        .NEXT_PUBLIC_API_URL,
    ).toBe("/backend");
    expect(() =>
      loadWebConfig({ NODE_ENV: "production", NEXT_PUBLIC_API_URL: "http://localhost:3001" }),
    ).toThrow(/HTTPS/);
  });
});
