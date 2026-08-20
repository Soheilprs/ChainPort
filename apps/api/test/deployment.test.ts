import { describe, expect, it } from "vitest";

import { createApiApplication } from "../src/app.js";
import { DeploymentService } from "../src/deployment-service.js";
import { createLogger } from "../src/logger.js";

const noopQueue = {
  enqueuePrepareDeployment: () => Promise.resolve(),
  enqueueBroadcastDeployment: () => Promise.resolve(),
  enqueueReconcileDeployment: () => Promise.resolve(),
};

describe("deployment API safety", () => {
  it("refuses mainnet targets before a run is created", async () => {
    const service = new DeploymentService(
      {
        getRevision: () =>
          Promise.resolve({
            id: "rev",
            projectId: "p",
            repositoryId: "r",
            baseRevisionId: null,
            baseCommitSha: "a",
            type: "ORIGINAL",
            changeSetId: null,
            contentHash: "git:a",
            completeness: null,
            createdAt: new Date(),
          }),
        getById: () => Promise.resolve(undefined),
      } as never,
      { getById: () => Promise.resolve(undefined) } as never,
      { latestCompleted: () => Promise.resolve(undefined) } as never,
      {} as never,
      noopQueue as never,
      { inspectDigest: () => Promise.resolve("digest") },
      {},
    );
    const app = await createApiApplication({
      logger: createLogger({ service: "api", level: "silent" }),
      readinessProbe: () => Promise.resolve(),
      webOrigin: "http://localhost:3000",
      deploymentService: service,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/revisions/rev/deployments",
      payload: { targetTestnetKey: "ethereum" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "MAINNET_DEPLOYMENT_FORBIDDEN" });
    await app.close();
  });

  it("rejects arbitrary command and RPC fields", async () => {
    const service = new DeploymentService(
      { getRevision: () => Promise.resolve(undefined) } as never,
      { getById: () => Promise.resolve(undefined) } as never,
      { latestCompleted: () => Promise.resolve(undefined) } as never,
      {} as never,
      noopQueue as never,
      { inspectDigest: () => Promise.resolve("digest") },
      {},
    );
    const app = await createApiApplication({
      logger: createLogger({ service: "api", level: "silent" }),
      readinessProbe: () => Promise.resolve(),
      webOrigin: "http://localhost:3000",
      deploymentService: service,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/revisions/rev/deployments",
      payload: { targetTestnetKey: "anvil", command: "forge script" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "ARBITRARY_COMMAND_REJECTED" });
    await app.close();
  });
});
