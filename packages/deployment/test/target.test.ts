import { describe, expect, it } from "vitest";

import { requireChainByKey } from "@chainport/chain-registry";

import { assertDeployableTarget, requireDeploymentTarget } from "../src/target.js";
import { DeploymentEngineError } from "../src/errors.js";

describe("mainnet refusal", () => {
  it("refuses production networks with MAINNET_DEPLOYMENT_FORBIDDEN and no override", () => {
    expect(() => requireDeploymentTarget("ethereum")).toThrow(DeploymentEngineError);
    expect(() => assertDeployableTarget(requireChainByKey("ethereum"))).toThrow(
      /Mainnet deployment is forbidden/,
    );
    expect(() => requireDeploymentTarget("optimism")).toThrow(/Mainnet deployment is forbidden/);
    expect(() => requireDeploymentTarget("base")).toThrow(/Mainnet deployment is forbidden/);
  });

  it("allows declared testnet and local anvil targets", () => {
    expect(requireDeploymentTarget("optimism-sepolia").chainId).toBe(11155420);
    expect(requireDeploymentTarget("anvil").chainId).toBe(31337);
  });
});
