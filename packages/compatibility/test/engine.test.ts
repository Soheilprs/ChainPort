import { snapshotForChainKey } from "@chainport/chain-registry";
import { describe, expect, it } from "vitest";

import { evaluateCompatibility } from "../src/index.js";
import { chainIdReq, evaluateAgainst, protocolReq, tokenReq } from "./helpers.js";

describe("compatibility engine", () => {
  it("is deterministic for the same snapshot and ruleset", () => {
    const requirements = [
      tokenReq("USDC", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
      protocolReq("CHAINLINK", "ORACLE"),
      chainIdReq("8453"),
    ];
    const first = evaluateAgainst("optimism", requirements, { hasSolidityContracts: true });
    const second = evaluateAgainst("optimism", requirements, { hasSolidityContracts: true });
    expect(first).toEqual(second);
    expect(first.registrySnapshotHash).toBe(snapshotForChainKey("optimism").hash);
    expect(first.rulesetVersion).toBe("2");
  });

  it("changes identity when the registry snapshot changes", () => {
    const requirements = [protocolReq("CHAINLINK", "ORACLE")];
    const original = evaluateAgainst("optimism", requirements);
    const mutated = evaluateAgainst("optimism", requirements, {
      snapshot: {
        ...snapshotForChainKey("optimism").snapshot,
        protocols: snapshotForChainKey("optimism").snapshot.protocols.map((item) =>
          item.id === "CHAINLINK"
            ? { ...item, availability: "UNAVAILABLE" as const, provenance: "VERIFIED" as const }
            : item,
        ),
      },
    });
    expect(mutated.registrySnapshotHash).not.toBe(original.registrySnapshotHash);
    expect(mutated.findings[0]?.status).toBe("BLOCKER");
    expect(original.findings[0]?.status).toBe("PASS");
  });

  it("adds a single EVM Solidity PASS instead of one row per pragma", () => {
    const report = evaluateCompatibility({
      sourceChainKey: "base",
      sourceChainId: 8453,
      sourceChainName: "Base",
      targetChainKey: "optimism",
      targetChainId: 10,
      targetChainName: "OP Mainnet",
      snapshot: snapshotForChainKey("optimism").snapshot,
      requirements: [],
      hasSolidityContracts: true,
    });
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({
      status: "PASS",
      category: "CONTRACTS",
      ruleId: "framework-compatibility",
    });
    expect(report.readiness).toBe("READY");
  });
});
