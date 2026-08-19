import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DockerSandboxRunner } from "../src/index.js";

const image = process.env.CHAINPORT_SANDBOX_IMAGE ?? "chainport/sandbox-foundry:1";

describe("sandbox adversarial isolation", () => {
  it("blocks docker socket, host secrets, and disabled network, then destroys the container", async () => {
    const runner = new DockerSandboxRunner();
    let available = true;
    try {
      await runner.inspectDigest(image);
    } catch {
      available = false;
    }
    if (!available) {
      expect(available).toBe(false);
      return;
    }
    const workspace = await mkdtemp(path.join(tmpdir(), "chainport-adv-"));
    await writeFile(path.join(workspace, "README"), "ok\n");
    const handle = await runner.prepare({
      image,
      workspaceHost: workspace,
      limits: { memoryBytes: 256 * 1024 * 1024, cpus: 1, pids: 64 },
      env: { DATABASE_URL: "should-not-pass" },
    });
    try {
      const socket = await runner.execute(handle, {
        argv: ["sh", "-c", "test ! -e /var/run/docker.sock"],
        timeoutMs: 5_000,
        network: "none",
      });
      expect(socket.exitCode).toBe(0);

      const env = await runner.execute(handle, {
        argv: ["sh", "-c", "printenv"],
        timeoutMs: 5_000,
        network: "none",
      });
      expect(env.stdout).not.toContain("DATABASE_URL=");
      expect(env.stdout).not.toContain("should-not-pass");
      expect(env.stdout).toContain("CI=true");

      const net = await runner.execute(handle, {
        argv: ["sh", "-c", "getent hosts example.com; echo done"],
        timeoutMs: 5_000,
        network: "none",
      });
      expect(net.stdout).not.toMatch(/example\.com/);

      const loop = await runner.execute(handle, {
        argv: ["sh", "-c", "while true; do :; done"],
        timeoutMs: 3_000,
        network: "none",
      });
      expect(loop.timedOut || loop.exitCode !== 0).toBe(true);
    } finally {
      await runner.destroy(handle);
    }
  }, 60_000);
});
