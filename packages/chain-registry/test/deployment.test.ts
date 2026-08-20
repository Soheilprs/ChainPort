import { describe, expect, it } from "vitest";

import {
  getOfficialDeploymentTestnet,
  listDeploymentTargets,
  requireChainByKey,
  snapshotForChainKey,
} from "../src/index.js";

describe("deployment registry", () => {
  it("maps production chains to official testnets without inferring from names", () => {
    expect(requireChainByKey("optimism").deploymentTestnetKey).toBe("optimism-sepolia");
    expect(requireChainByKey("base").deploymentTestnetKey).toBe("base-sepolia");
    expect(getOfficialDeploymentTestnet("optimism")?.chainId).toBe(11155420);
    expect(getOfficialDeploymentTestnet("base")?.chainId).toBe(84532);
  });

  it("enables only declared testnet/devnet targets", () => {
    const keys = listDeploymentTargets().map((chain) => chain.key);
    expect(keys).toEqual(
      expect.arrayContaining(["sepolia", "optimism-sepolia", "base-sepolia", "anvil"]),
    );
    expect(requireChainByKey("ethereum").deployment).toBeUndefined();
    expect(requireChainByKey("optimism").networkKind).toBe("mainnet");
    expect(requireChainByKey("optimism-sepolia").deployment?.environment).toBe("TESTNET");
    expect(requireChainByKey("anvil").deployment?.environment).toBe("DEVNET");
    expect(requireChainByKey("anvil").chainId).toBe(31337);
  });

  it("does not change historical compatibility snapshot hashes when deployment metadata is present", () => {
    const base = snapshotForChainKey("base");
    expect(base.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(base.canonicalJson).not.toContain("deploymentTestnetKey");
    expect(base.canonicalJson).not.toContain("maxFundingWei");
  });
});
