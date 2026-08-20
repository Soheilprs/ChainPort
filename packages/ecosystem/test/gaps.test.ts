import { describe, expect, it } from "vitest";

import { classifyFinding, isInfrastructureGap, semanticCapabilityKey } from "../src/gaps.js";

describe("infrastructure gap classification", () => {
  it("treats missing oracles as NETWORK_GAP and unknown LayerZero as UNKNOWN_NETWORK_DATA", () => {
    const oracle = classifyFinding({
      ruleId: "oracle-availability",
      status: "BLOCKER",
      category: "ORACLES",
      remediationType: "INFRASTRUCTURE_REQUIRED",
      sourceValue: "CHAINLINK_PRICE_FEED:ETH/USD",
      targetValue: "UNAVAILABLE",
      title: "Chainlink ETH/USD unavailable",
    });
    const layerzero = classifyFinding({
      ruleId: "layerzero",
      status: "UNKNOWN",
      category: "CROSS_CHAIN",
      remediationType: "UNKNOWN",
      sourceValue: "LAYERZERO",
      targetValue: "UNKNOWN",
      title: "LayerZero unknown",
    });
    const chainId = classifyFinding({
      ruleId: "chain-id",
      status: "BLOCKER",
      category: "CONFIGURATION",
      remediationType: "CONFIG_CHANGE",
      sourceValue: "1",
      targetValue: "10",
      title: "Hardcoded chain ID",
    });
    expect(oracle).toBe("NETWORK_GAP");
    expect(isInfrastructureGap(oracle)).toBe(true);
    expect(layerzero).toBe("UNKNOWN_NETWORK_DATA");
    expect(isInfrastructureGap(layerzero)).toBe(true);
    expect(chainId).toBe("PROJECT_CONFIG");
    expect(isInfrastructureGap(chainId)).toBe(false);
  });

  it("normalizes oracle and protocol keys", () => {
    expect(
      semanticCapabilityKey({
        ruleId: "oracle-availability",
        status: "BLOCKER",
        category: "ORACLES",
        remediationType: "INFRASTRUCTURE_REQUIRED",
        sourceValue: "ETH/USD",
        targetValue: "UNAVAILABLE",
        title: "feed",
      }),
    ).toBe("oracle:CHAINLINK_PRICE_FEED:ETH/USD");
    expect(
      semanticCapabilityKey({
        ruleId: "layerzero",
        status: "UNKNOWN",
        category: "CROSS_CHAIN",
        remediationType: "UNKNOWN",
        sourceValue: "LAYERZERO",
        targetValue: "UNKNOWN",
        title: "lz",
      }),
    ).toBe("protocol:LAYERZERO");
  });
});
