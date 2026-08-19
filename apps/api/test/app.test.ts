import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiApplication } from "../src/app.js";
import { createLogger } from "../src/logger.js";

const applications: Array<Awaited<ReturnType<typeof createApiApplication>>> = [];

afterEach(async () => {
  await Promise.all(applications.splice(0).map((app) => app.close()));
});

async function makeApplication(readinessProbe: () => Promise<void>) {
  const app = await createApiApplication({
    logger: createLogger({ service: "api", level: "silent" }),
    readinessProbe,
    webOrigin: "http://localhost:3000",
  });
  applications.push(app);
  return app;
}

describe("API foundation routes", () => {
  it("returns process health without running the readiness probe", async () => {
    const readinessProbe = vi.fn<() => Promise<void>>();
    const response = await (
      await makeApplication(readinessProbe)
    ).inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: "api",
      product: "ChainPort",
      phase: 3,
    });
    expect(readinessProbe).not.toHaveBeenCalled();
  });

  it("returns ready when the process probe succeeds", async () => {
    const response = await (
      await makeApplication(() => Promise.resolve())
    ).inject({
      method: "GET",
      url: "/ready",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ready", service: "api" });
  });

  it("returns 503 without leaking probe errors when readiness fails", async () => {
    const response = await (
      await makeApplication(() =>
        Promise.reject(new Error("postgresql://secret-user:secret-password@internal/database")),
      )
    ).inject({ method: "GET", url: "/ready" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ status: "not_ready", service: "api" });
    expect(response.body).not.toContain("secret-password");
  });

  it("returns a structured 404 for unknown routes", async () => {
    const response = await (
      await makeApplication(() => Promise.resolve())
    ).inject({
      method: "GET",
      url: "/projects",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      status: "error",
      code: "ROUTE_NOT_FOUND",
    });
  });

  it("exposes product metadata", async () => {
    const response = await (
      await makeApplication(() => Promise.resolve())
    ).inject({
      method: "GET",
      url: "/v1/meta",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: {
        name: "ChainPort",
        phase: 3,
        phaseName: "Repository intelligence",
      },
    });
  });
});
