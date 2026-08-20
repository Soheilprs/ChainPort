import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getDatabaseClient,
  IngestRepository,
  PartnerRepository,
  resetIntegrationDatabase,
} from "@chainport/db";
import { EcosystemAnalytics } from "@chainport/ecosystem";
import { INTEGRATION_TEST_DATABASE_PURPOSE } from "@chainport/shared";

import { createApiApplication } from "../src/app.js";
import { createLogger } from "../src/logger.js";
import { NetworkService } from "../src/network-service.js";
import { ProjectsService } from "../src/projects-service.js";
import { PublicPartnerService } from "../src/public-partners-service.js";

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

async function makeApp() {
  const partners = new PartnerRepository(database);
  const projects = new ProjectsService(
    new IngestRepository(database),
    {
      enqueueIngest: vi.fn(() => Promise.resolve()),
      enqueueAnalysis: vi.fn(() => Promise.resolve()),
      enqueueGenerateChangeSet: vi.fn(() => Promise.resolve()),
      enqueueFinalizeChangeSet: vi.fn(() => Promise.resolve()),
      enqueueValidate: vi.fn(() => Promise.resolve()),
      close: () => Promise.resolve(),
    },
    partners,
  );
  const app = await createApiApplication({
    logger: createLogger({ service: "api", level: "silent" }),
    readinessProbe: () => Promise.resolve(),
    webOrigin: "http://localhost:3000",
    projectsService: projects,
    networkService: new NetworkService(partners, new EcosystemAnalytics(database)),
    publicPartnerService: new PublicPartnerService(partners, projects),
  });
  applications.push(app);
  return app;
}

describe("public partner portal", () => {
  it("creates a branded partner, exposes public config, and locks the target", async () => {
    const app = await makeApp();
    const created = await app.inject({
      method: "POST",
      url: "/v1/network-partners",
      payload: {
        networkKey: "optimism",
        displayName: "Optimism",
        slug: "optimism",
        shortDescription: "Migrate your EVM application to Optimism",
        docsUrl: "https://docs.optimism.io",
        primaryAccent: "#ff0420",
      },
    });
    expect(created.statusCode).toBe(201);
    const partner = jsonData(created.body);
    expect(partner).toMatchObject({ slug: "optimism", networkKey: "optimism" });
    expect(partner).not.toHaveProperty("analytics");

    const publicConfig = await app.inject({
      method: "GET",
      url: "/v1/public/partners/optimism",
    });
    expect(publicConfig.statusCode).toBe(200);
    const config = jsonData(publicConfig.body);
    expect(config).toMatchObject({
      slug: "optimism",
      displayName: "Optimism",
      networkKey: "optimism",
      portal: { creationEnabled: true },
    });
    expect(config).not.toHaveProperty("organizationId");
    expect(config).not.toHaveProperty("id");
    expect(config).not.toHaveProperty("isDemo");

    const mismatch = await app.inject({
      method: "POST",
      url: "/v1/public/partners/optimism/projects",
      payload: {
        repositoryUrl: "https://github.com/acme/wallet",
        sourceChainKey: "ethereum",
        targetChainKey: "base",
      },
    });
    expect(mismatch.statusCode).toBe(400);
    expect(mismatch.json()).toMatchObject({ code: "PARTNER_TARGET_MISMATCH" });

    const createdProject = await app.inject({
      method: "POST",
      url: "/v1/public/partners/optimism/projects",
      payload: {
        repositoryUrl: "https://github.com/acme/wallet",
        sourceChainKey: "ethereum",
      },
    });
    expect(createdProject.statusCode).toBe(201);
    const projectPayload = jsonData(createdProject.body);
    expect(projectPayload).toMatchObject({
      job: { sourceChainKey: "ethereum", targetChainKey: "optimism" },
      project: { acquisitionSource: "PARTNER_PORTAL", partner: { slug: "optimism" } },
    });

    const generic = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        repositoryUrl: "https://github.com/acme/other",
        sourceChainKey: "ethereum",
        targetChainKey: "optimism",
      },
    });
    expect(generic.statusCode).toBe(201);
    expect(jsonData(generic.body)).toMatchObject({
      project: { acquisitionSource: "GENERIC_PORTAL", partner: null },
      job: { targetChainKey: "optimism" },
    });

    const partnerId = String(partner.id);
    const overview = await app.inject({
      method: "GET",
      url: `/v1/network-partners/${partnerId}/overview?range=all`,
    });
    expect(overview.statusCode).toBe(200);
    expect(jsonData(overview.body)).toMatchObject({
      attribution: {
        version: "phase-10",
        allTargetingNetwork: 2,
        partnerReferred: 1,
        genericTargetingNetwork: 1,
      },
      kpis: { projectsStarted: 2 },
    });

    const referred = await app.inject({
      method: "GET",
      url: `/v1/network-partners/${partnerId}/funnel?range=all&acquisition=partner`,
    });
    expect(jsonData(referred.body)).toMatchObject({
      acquisition: "partner",
      counts: { PROJECT_STARTED: 1 },
    });
  });

  it("handles unknown, disabled, and paused portals without listing partners publicly", async () => {
    const app = await makeApp();
    expect((await app.inject({ method: "GET", url: "/v1/public/partners" })).statusCode).toBe(404);

    const missing = await app.inject({ method: "GET", url: "/v1/public/partners/unknown" });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ code: "PARTNER_NOT_FOUND" });

    const created = await app.inject({
      method: "POST",
      url: "/v1/network-partners",
      payload: { networkKey: "base", displayName: "Base", slug: "base" },
    });
    const id = String(jsonData(created.body).id);

    await app.inject({
      method: "PATCH",
      url: `/v1/network-partners/${id}`,
      payload: { status: "PAUSED" },
    });
    const pausedGet = await app.inject({ method: "GET", url: "/v1/public/partners/base" });
    expect(pausedGet.statusCode).toBe(200);
    expect(jsonData(pausedGet.body)).toMatchObject({
      portal: { paused: true, creationEnabled: false },
    });
    const pausedPost = await app.inject({
      method: "POST",
      url: "/v1/public/partners/base/projects",
      payload: { repositoryUrl: "https://github.com/acme/paused", sourceChainKey: "ethereum" },
    });
    expect(pausedPost.statusCode).toBe(409);
    expect(pausedPost.json()).toMatchObject({ code: "PARTNER_PORTAL_PAUSED" });

    await app.inject({
      method: "PATCH",
      url: `/v1/network-partners/${id}`,
      payload: { status: "DISABLED" },
    });
    const disabled = await app.inject({ method: "GET", url: "/v1/public/partners/base" });
    expect(disabled.statusCode).toBe(404);
    expect(disabled.json()).toMatchObject({ code: "PORTAL_UNAVAILABLE" });
  });

  it("rejects duplicate slugs, invalid links, and DEVNET partners", async () => {
    const app = await makeApp();
    const first = await app.inject({
      method: "POST",
      url: "/v1/network-partners",
      payload: { networkKey: "optimism", displayName: "Optimism", slug: "optimism" },
    });
    expect(first.statusCode).toBe(201);

    const duplicate = await app.inject({
      method: "POST",
      url: "/v1/network-partners",
      payload: { networkKey: "base", displayName: "Base", slug: "optimism" },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ code: "SLUG_EXISTS" });

    const badLink = await app.inject({
      method: "POST",
      url: "/v1/network-partners",
      payload: {
        networkKey: "base",
        displayName: "Base",
        slug: "base",
        docsUrl: "javascript:alert(1)",
      },
    });
    expect(badLink.statusCode).toBe(400);
    expect(badLink.json()).toMatchObject({ code: "INVALID_PARTNER_URL" });

    const dataLogo = await app.inject({
      method: "POST",
      url: "/v1/network-partners",
      payload: {
        networkKey: "base",
        displayName: "Base",
        slug: "base",
        logoUrl: "data:image/png;base64,abc",
      },
    });
    expect(dataLogo.statusCode).toBe(400);
    expect(dataLogo.json()).toMatchObject({ code: "INVALID_PARTNER_LOGO" });

    const anvil = await app.inject({
      method: "POST",
      url: "/v1/network-partners",
      payload: { networkKey: "anvil", displayName: "Anvil", slug: "anvil" },
    });
    expect(anvil.statusCode).toBe(400);
    expect(anvil.json()).toMatchObject({ code: "INVALID_NETWORK" });
  });
});

function jsonData(body: string): Record<string, unknown> {
  const payload: unknown = JSON.parse(body);
  if (
    typeof payload === "object" &&
    payload !== null &&
    "data" in payload &&
    typeof payload.data === "object" &&
    payload.data !== null
  ) {
    return payload.data as Record<string, unknown>;
  }
  throw new Error("expected data payload");
}
