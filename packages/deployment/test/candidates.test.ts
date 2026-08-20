import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { assertSafeCandidatePath, detectDeploymentCandidates } from "../src/candidates.js";
import { rejectArbitraryCommand } from "../src/commands.js";
import { DeploymentEngineError } from "../src/errors.js";

const fixture = path.join(fileURLToPath(new URL(".", import.meta.url)), "fixtures/foundry-deploy");

describe("deployment candidates", () => {
  it("detects Foundry Script contracts with run()", async () => {
    const candidates = await detectDeploymentCandidates(fixture);
    expect(candidates.some((item) => item.filePath === "script/Deploy.s.sol")).toBe(true);
    expect(candidates[0]?.confidence).toBe("DETECTED");
  });

  it("rejects arbitrary commands, RPC URLs, and unsafe paths", () => {
    expect(() => rejectArbitraryCommand({ command: "rm -rf /" })).toThrow(DeploymentEngineError);
    expect(() => rejectArbitraryCommand({ rpcUrl: "https://evil.example" })).toThrow(
      DeploymentEngineError,
    );
    expect(() => assertSafeCandidatePath("../etc/passwd")).toThrow(/not allowed/);
  });
});
