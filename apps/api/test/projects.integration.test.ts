import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDatabaseClient, IngestRepository, resetIntegrationDatabase } from "@chainport/db";
import { INTEGRATION_TEST_DATABASE_PURPOSE } from "@chainport/shared";

import { createApiApplication } from "../src/app.js";
import { createLogger } from "../src/logger.js";
import { ProjectsService } from "../src/projects-service.js";

const applications: Array<Awaited<ReturnType<typeof createApiApplication>>> = [];
const database = getDatabaseClient();

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
  const enqueueIngest = vi.fn(() => Promise.resolve());
  const service = new ProjectsService(new IngestRepository(database), {
    enqueueIngest,
    enqueueAnalysis: vi.fn(() => Promise.resolve()),
    enqueueGenerateChangeSet: vi.fn(() => Promise.resolve()),
    enqueueFinalizeChangeSet: vi.fn(() => Promise.resolve()),
    enqueueValidate: vi.fn(() => Promise.resolve()),
    close: () => Promise.resolve(),
  });
  const app = await createApiApplication({
    logger: createLogger({ service: "api", level: "silent" }),
    readinessProbe: () => Promise.resolve(),
    webOrigin: "http://localhost:3000",
    projectsService: service,
  });
  applications.push(app);
  return { app, enqueueIngest };
}

describe("POST /v1/projects", () => {
  it("creates a project, repository, and queued job", async () => {
    const { app, enqueueIngest } = await makeApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        repositoryUrl: "https://github.com/acme/wallet.git",
        sourceChainKey: "ethereum",
        targetChainKey: "base",
      },
    });
    expect(response.statusCode).toBe(201);
    const payload: unknown = response.json();
    expect(payload).toMatchObject({
      data: {
        project: { githubOwner: "acme", githubRepo: "wallet" },
        repository: { provider: "GITHUB", owner: "acme", name: "wallet" },
        job: { status: "QUEUED", sourceChainKey: "ethereum", targetChainKey: "base" },
      },
    });
    expect(enqueueIngest).toHaveBeenCalledOnce();
  });

  it("is idempotent for the same repository and chain pair", async () => {
    const { app } = await makeApp();
    const payload = {
      repositoryUrl: "https://github.com/acme/wallet",
      sourceChainKey: "ethereum",
      targetChainKey: "base",
    };
    const first = await app.inject({ method: "POST", url: "/v1/projects", payload });
    const second = await app.inject({ method: "POST", url: "/v1/projects", payload });
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    const firstId = readJobId(first.json());
    const secondId = readJobId(second.json());
    expect(firstId).toEqual(secondId);
  });
});

function readJobId(payload: unknown): string {
  if (typeof payload !== "object" || payload === null || !("data" in payload)) {
    return "";
  }
  const data = payload.data;
  if (typeof data !== "object" || data === null || !("job" in data)) {
    return "";
  }
  const job = data.job;
  if (typeof job !== "object" || job === null || !("id" in job) || typeof job.id !== "string") {
    return "";
  }
  return job.id;
}
