import { afterAll, describe, expect, it } from "vitest";

import { INTEGRATION_TEST_DATABASE_PURPOSE } from "@chainport/shared";

import { checkDatabase, disconnectDatabase, getDatabaseClient } from "../src/index.js";

describe("database connectivity", () => {
  afterAll(async () => {
    await disconnectDatabase();
  });

  it("only runs against the integration-test catalog", () => {
    expect(process.env.CHAINPORT_DB_PURPOSE).toBe(INTEGRATION_TEST_DATABASE_PURPOSE);
    expect(process.env.DATABASE_URL ?? "").toContain("chainport_integration");
  });

  it("can SELECT 1", async () => {
    await expect(checkDatabase(getDatabaseClient())).resolves.toBeUndefined();
  });
});
