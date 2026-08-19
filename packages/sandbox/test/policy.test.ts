import { describe, expect, it } from "vitest";

import {
  assertSandboxPolicy,
  assertSandboxRunnerAvailable,
  SANDBOX_IMPLEMENTATION_STATUS,
  SANDBOX_POLICY,
  SandboxPolicyError,
} from "../src/index.js";

describe("sandbox policy", () => {
  it("forbids host execution, privileged mode, and docker socket mounts", () => {
    expect(SANDBOX_POLICY.executeOnHost).toBe(false);
    expect(() => assertSandboxPolicy({ location: "host" })).toThrow(SandboxPolicyError);
    expect(() => assertSandboxPolicy({ location: "isolated-container", privileged: true })).toThrow(
      /privileged/,
    );
    expect(() =>
      assertSandboxPolicy({ location: "isolated-container", dockerSocketMounted: true }),
    ).toThrow(/Docker socket/);
  });

  it("accepts an isolated unprivileged request without claiming a runner exists", () => {
    expect(() => assertSandboxPolicy({ location: "isolated-container" })).not.toThrow();
    expect(SANDBOX_IMPLEMENTATION_STATUS).toBe("implemented");
    expect(() => assertSandboxRunnerAvailable()).not.toThrow();
  });
});
