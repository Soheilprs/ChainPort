import { afterEach, describe, expect, it } from "vitest";

import { createApiApplication } from "../src/app.js";
import { createLogger } from "../src/logger.js";

const applications: Array<Awaited<ReturnType<typeof createApiApplication>>> = [];

afterEach(async () => {
  await Promise.all(applications.splice(0).map((app) => app.close()));
});

async function makeApplication() {
  const app = await createApiApplication({
    logger: createLogger({ service: "api", level: "silent" }),
    readinessProbe: () => Promise.resolve(),
    webOrigin: "http://localhost:3000",
  });
  applications.push(app);
  return app;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function stringField(value: unknown, field: string): string | undefined {
  const record = asRecord(value);
  if (record === undefined) {
    return undefined;
  }
  const fieldValue = record[field];
  return typeof fieldValue === "string" ? fieldValue : undefined;
}

function unknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function chainKeys(payload: unknown): string[] {
  return unknownArray(asRecord(payload)?.data)
    .map((item) => stringField(item, "key"))
    .filter((key): key is string => key !== undefined);
}

function oracleStatuses(payload: unknown): string[] {
  const infrastructure = asRecord(asRecord(payload)?.data)?.infrastructure;
  const oracles = asRecord(infrastructure)?.oracles;
  return unknownArray(oracles)
    .map((item) => stringField(item, "status"))
    .filter((status): status is string => status !== undefined);
}

describe("chain catalog routes", () => {
  it("lists registered chains", async () => {
    const response = await (await makeApplication()).inject({ method: "GET", url: "/v1/chains" });
    expect(response.statusCode).toBe(200);
    expect(chainKeys(response.json())).toEqual(
      expect.arrayContaining(["ethereum", "base", "arbitrum-one", "optimism"]),
    );
  });

  it("returns a chain with capabilities and does not invent availability", async () => {
    const response = await (
      await makeApplication()
    ).inject({
      method: "GET",
      url: "/v1/chains/unichain",
    });
    expect(response.statusCode).toBe(200);
    expect(oracleStatuses(response.json())).toContain("unknown");
  });

  it("returns CHAIN_NOT_FOUND for unknown keys", async () => {
    const response = await (
      await makeApplication()
    ).inject({
      method: "GET",
      url: "/v1/chains/not-a-chain",
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: "CHAIN_NOT_FOUND" });
  });
});
