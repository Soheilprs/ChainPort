import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getDatabaseClient,
  IdentityRepository,
  IngestRepository,
  PartnerRepository,
  resetIntegrationDatabase,
} from "@chainport/db";
import { EcosystemAnalytics } from "@chainport/ecosystem";
import { INTEGRATION_TEST_DATABASE_PURPOSE, loadServiceConfig } from "@chainport/shared";

import { AccessControl } from "../src/access.js";
import { createApiApplication } from "../src/app.js";
import { AuthService } from "../src/auth-service.js";
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
  const config = loadServiceConfig();
  const identities = new IdentityRepository(database);
  const ingest = new IngestRepository(database);
  const partners = new PartnerRepository(database);
  const authService = new AuthService(identities, config);
  const access = new AccessControl(ingest, partners);
  const queue = {
    enqueueIngest: () => Promise.resolve(),
    enqueueAnalysis: () => Promise.resolve(),
    enqueueGenerateChangeSet: () => Promise.resolve(),
    enqueueFinalizeChangeSet: () => Promise.resolve(),
    enqueueValidate: () => Promise.resolve(),
    close: () => Promise.resolve(),
  };
  const projects = new ProjectsService(ingest, queue, partners);
  const app = await createApiApplication({
    logger: createLogger({ service: "api", level: "silent" }),
    readinessProbe: () => Promise.resolve(),
    webOrigin: "http://localhost:3000",
    config,
    authService,
    access,
    projectsService: projects,
    networkService: new NetworkService(partners, new EcosystemAnalytics(database)),
    publicPartnerService: new PublicPartnerService(partners, projects),
  });
  applications.push(app);
  return app;
}

async function login(
  app: Awaited<ReturnType<typeof createApiApplication>>,
  payload: Record<string, unknown>,
) {
  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/test/login",
    payload,
  });
  expect(response.statusCode).toBe(200);
  const body = jsonData(response.body);
  const sessionToken = String(body.sessionToken);
  const user = body.user as { id: string };
  return {
    token: sessionToken,
    userId: user.id,
    headers: { authorization: `Bearer ${sessionToken}` },
  };
}

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
  if (typeof payload === "object" && payload !== null) {
    return payload as Record<string, unknown>;
  }
  throw new Error("invalid json");
}

describe("pilot security", () => {
  it("rejects unauthenticated access to protected APIs and keeps partner landing public", async () => {
    const app = await makeApp();
    const protectedGet = await app.inject({ method: "GET", url: "/v1/projects" });
    expect(protectedGet.statusCode).toBe(401);
    expect(jsonData(protectedGet.body).code).toBe("AUTHENTICATION_REQUIRED");
    expect(typeof jsonData(protectedGet.body).requestId).toBe("string");

    const created = await app.inject({
      method: "POST",
      url: "/v1/network-partners",
      payload: { networkKey: "optimism", displayName: "Optimism", slug: "optimism" },
    });
    expect(created.statusCode).toBe(401);

    const landing = await app.inject({ method: "GET", url: "/v1/public/partners/missing" });
    expect(landing.statusCode).toBe(404);
  });

  it("enforces IDOR: Bob cannot read Alice's project by id", async () => {
    const app = await makeApp();
    const alice = await login(app, { email: "alice@example.com", name: "Alice" });
    const bob = await login(app, { email: "bob@example.com", name: "Bob" });
    const created = await app.inject({
      method: "POST",
      url: "/v1/projects",
      headers: alice.headers,
      payload: {
        repositoryUrl: "https://github.com/alice/wallet",
        sourceChainKey: "ethereum",
        targetChainKey: "optimism",
      },
    });
    expect(created.statusCode).toBe(201);
    const createdData = jsonData(created.body);
    const project = createdData.project as { id: string };
    const job = createdData.job as { id: string };
    const projectId = project.id;
    const jobId = job.id;

    const stolenProject = await app.inject({
      method: "GET",
      url: `/v1/projects/${projectId}`,
      headers: bob.headers,
    });
    expect(stolenProject.statusCode).toBe(404);
    const stolenJob = await app.inject({
      method: "GET",
      url: `/v1/jobs/${jobId}`,
      headers: bob.headers,
    });
    expect(stolenJob.statusCode).toBe(404);

    const own = await app.inject({
      method: "GET",
      url: `/v1/projects/${projectId}`,
      headers: alice.headers,
    });
    expect(own.statusCode).toBe(200);
    expect(jsonData(own.body).project).toMatchObject({
      acquisitionSource: "GENERIC_PORTAL",
    });
  });

  it("isolates foundation partners and requires auth for partner project creation", async () => {
    const app = await makeApp();
    const admin = await login(app, { email: "root@chainport.test", isPlatformAdmin: true });
    const optimism = await app.inject({
      method: "POST",
      url: "/v1/network-partners",
      headers: admin.headers,
      payload: { networkKey: "optimism", displayName: "Optimism", slug: "optimism" },
    });
    const base = await app.inject({
      method: "POST",
      url: "/v1/network-partners",
      headers: admin.headers,
      payload: { networkKey: "base", displayName: "Base", slug: "base" },
    });
    expect(optimism.statusCode).toBe(201);
    expect(base.statusCode).toBe(201);
    const optimismId = String(jsonData(optimism.body).id);
    const baseId = String(jsonData(base.body).id);

    const opAnalyst = await login(app, { email: "op@example.com" });
    const optimismOrg = String(jsonData(optimism.body).organizationId);
    await new IdentityRepository(database).addMembership({
      userId: opAnalyst.userId,
      organizationId: optimismOrg,
      role: "MEMBER",
    });
    const allowed = await app.inject({
      method: "GET",
      url: `/v1/network-partners/${optimismId}/overview`,
      headers: opAnalyst.headers,
    });
    expect(allowed.statusCode).toBe(200);
    const forbidden = await app.inject({
      method: "GET",
      url: `/v1/network-partners/${baseId}/overview`,
      headers: opAnalyst.headers,
    });
    expect(forbidden.statusCode).toBe(404);

    const unauthenticatedCreate = await app.inject({
      method: "POST",
      url: "/v1/public/partners/optimism/projects",
      payload: { repositoryUrl: "https://github.com/acme/wallet", sourceChainKey: "ethereum" },
    });
    expect(unauthenticatedCreate.statusCode).toBe(401);

    const developer = await login(app, { email: "dev@example.com" });
    const created = await app.inject({
      method: "POST",
      url: "/v1/public/partners/optimism/projects",
      headers: developer.headers,
      payload: { repositoryUrl: "https://github.com/acme/wallet", sourceChainKey: "ethereum" },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      data: {
        project: { acquisitionSource: "PARTNER_PORTAL" },
        job: { targetChainKey: "optimism" },
      },
    });
    expect(optimismId).toBeTruthy();
  });

  it("completes the OIDC callback and issues a session without an open redirect", async () => {
    const app = await makeApp();
    const started = await app.inject({
      method: "GET",
      url: "/v1/auth/oidc/start?returnTo=/app/projects",
    });
    expect(started.statusCode).toBe(302);
    const location = started.headers.location;
    expect(typeof location).toBe("string");
    const redirected = new URL(String(location));
    const cookies = Object.fromEntries(
      started.cookies.map((cookie) => [cookie.name, cookie.value]),
    );
    expect(cookies.chainport_oidc_state).toBeDefined();
    expect(cookies.chainport_oidc_nonce).toBeDefined();

    const rejected = await app.inject({
      method: "GET",
      url: `/v1/auth/oidc/callback?${redirected.searchParams.toString()}`,
    });
    expect(rejected.statusCode).toBe(401);

    const completed = await app.inject({
      method: "GET",
      url: `/v1/auth/oidc/callback?${redirected.searchParams.toString()}`,
      cookies: {
        chainport_oidc_state: cookies.chainport_oidc_state ?? "",
        chainport_oidc_nonce: cookies.chainport_oidc_nonce ?? "",
      },
    });
    expect(completed.statusCode).toBe(302);
    expect(String(completed.headers.location)).toBe("http://localhost:3000/app/projects");
    const session = completed.cookies.find((cookie) => cookie.name === "chainport_session");
    expect(session?.value).toMatch(/^[A-Za-z0-9_-]+$/);

    const forged = await app.inject({
      method: "GET",
      url: "/v1/auth/oidc/start?returnTo=https://evil.example/phish",
    });
    const forgedLocation = new URL(String(forged.headers.location));
    const forgedCookies = Object.fromEntries(
      forged.cookies.map((cookie) => [cookie.name, cookie.value]),
    );
    const forgedComplete = await app.inject({
      method: "GET",
      url: `/v1/auth/oidc/callback?${forgedLocation.searchParams.toString()}`,
      cookies: {
        chainport_oidc_state: forgedCookies.chainport_oidc_state ?? "",
        chainport_oidc_nonce: forgedCookies.chainport_oidc_nonce ?? "",
      },
    });
    expect(forgedComplete.statusCode).toBe(302);
    expect(String(forgedComplete.headers.location)).toBe("http://localhost:3000/app/projects");
  });
});
