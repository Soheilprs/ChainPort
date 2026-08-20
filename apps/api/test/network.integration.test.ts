import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { getDatabaseClient, PartnerRepository, resetIntegrationDatabase } from "@chainport/db";
import { EcosystemAnalytics } from "@chainport/ecosystem";
import { INTEGRATION_TEST_DATABASE_PURPOSE } from "@chainport/shared";

import { createApiApplication } from "../src/app.js";
import { createLogger } from "../src/logger.js";
import { NetworkService } from "../src/network-service.js";

const database = getDatabaseClient();
const applications: Array<Awaited<ReturnType<typeof createApiApplication>>> = [];

beforeEach(async () => {
  expect(process.env.CHAINPORT_DB_PURPOSE).toBe(INTEGRATION_TEST_DATABASE_PURPOSE);
  await resetIntegrationDatabase(database);
});

afterEach(async () => {
  await Promise.all(applications.splice(0).map((app) => app.close()));
});

afterAll(async () => {
  await database.$disconnect();
});

describe("network partner API", () => {
  it("creates a partner, refuses Anvil, and returns empty funnel metrics", async () => {
    const app = await createApiApplication({
      logger: createLogger({ service: "api", level: "silent" }),
      readinessProbe: () => Promise.resolve(),
      webOrigin: "http://localhost:3000",
      networkService: new NetworkService(
        new PartnerRepository(database),
        new EcosystemAnalytics(database),
      ),
    });
    applications.push(app);

    const anvil = await app.inject({
      method: "POST",
      url: "/v1/network-partners",
      payload: { networkKey: "anvil", displayName: "Anvil" },
    });
    expect(anvil.statusCode).toBe(400);
    expect(anvil.json()).toMatchObject({ code: "INVALID_NETWORK" });

    const created = await app.inject({
      method: "POST",
      url: "/v1/network-partners",
      payload: { networkKey: "optimism", displayName: "Optimism" },
    });
    expect(created.statusCode).toBe(201);
    const partnerId = partnerIdFrom(JSON.parse(created.body) as unknown);

    const funnel = await app.inject({
      method: "GET",
      url: `/v1/network-partners/${partnerId}/funnel?range=all`,
    });
    expect(funnel.statusCode).toBe(200);
    const funnelPayload: unknown = JSON.parse(funnel.body);
    expect(funnelPayload).toMatchObject({
      data: {
        counts: { PROJECT_STARTED: 0 },
        conversions: { startedToDeployed: null },
      },
    });
  });
});

function partnerIdFrom(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "data" in payload &&
    typeof payload.data === "object" &&
    payload.data !== null &&
    "id" in payload.data &&
    typeof payload.data.id === "string"
  ) {
    return payload.data.id;
  }
  throw new Error("partner id missing");
}
