import { describe, expect, it, vi } from "vitest";

import { createLogger } from "../src/logger.js";
import { startWorkerRuntime } from "../src/runtime.js";

describe("worker runtime", () => {
  it("requires redis and does not register processors in phase 1", async () => {
    const redis = {
      ping: vi.fn(() => Promise.resolve("PONG")),
      quit: vi.fn(() => Promise.resolve("OK")),
    };
    const runtime = await startWorkerRuntime({
      workerId: "worker-1",
      redis,
      logger: createLogger({ service: "worker", level: "silent" }),
    });

    expect(runtime.registeredQueues).toEqual(["migration-jobs"]);
    expect(runtime.registeredProcessors).toEqual([]);
    await runtime.stop("SIGTERM");
    expect(redis.quit).toHaveBeenCalledOnce();
    await runtime.stop("SIGTERM");
    expect(redis.quit).toHaveBeenCalledOnce();
  });

  it("fails loudly when redis is unavailable", async () => {
    await expect(
      startWorkerRuntime({
        workerId: "worker-1",
        redis: {
          ping: () => Promise.resolve("NOPE"),
          quit: () => Promise.resolve("OK"),
        },
        logger: createLogger({ service: "worker", level: "silent" }),
      }),
    ).rejects.toThrow(/redis is unavailable/);
  });
});
