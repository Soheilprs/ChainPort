import { describe, expect, it } from "vitest";

import {
  chainIdReq,
  evaluateAgainst,
  mutateSnapshot,
  protocolReq,
  requirement,
  rpcMethodReq,
  tokenReq,
} from "./helpers.js";

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const OP_USDC = "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85";
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const OP_STACK_WETH = "0x4200000000000000000000000000000000000006";

describe("compatibility rules", () => {
  it("A: hardcoded source USDC with verified target equivalent is WARNING, not PASS", () => {
    const report = evaluateAgainst("optimism", [tokenReq("USDC", BASE_USDC)]);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({
      status: "WARNING",
      category: "TOKENS",
      remediationType: "ADDRESS_MAPPING",
      targetValue: OP_USDC,
    });
  });

  it("B: explicit Chainlink unavailability is BLOCKER for DETECTED usage", () => {
    const snapshot = mutateSnapshot("optimism", (current) => ({
      ...current,
      protocols: current.protocols.map((item) =>
        item.id === "CHAINLINK"
          ? { ...item, availability: "UNAVAILABLE" as const, provenance: "VERIFIED" as const }
          : item,
      ),
    }));
    const report = evaluateAgainst("optimism", [protocolReq("CHAINLINK", "ORACLE")], { snapshot });
    expect(report.findings[0]?.status).toBe("BLOCKER");
    expect(report.readiness).toBe("BLOCKED");
  });

  it("C: unknown Chainlink stays UNKNOWN and is never converted to BLOCKER", () => {
    const report = evaluateAgainst("unichain", [protocolReq("CHAINLINK", "ORACLE")]);
    expect(report.findings[0]?.status).toBe("UNKNOWN");
    expect(report.counts.blocker).toBe(0);
    expect(report.readiness).not.toBe("BLOCKED");
  });

  it("D: debug_traceCall explicitly unavailable is BLOCKER", () => {
    const snapshot = mutateSnapshot("optimism", (current) => ({
      ...current,
      rpcMethods: current.rpcMethods.map((item) =>
        item.method === "debug_traceCall"
          ? { ...item, availability: "UNAVAILABLE" as const, provenance: "VERIFIED" as const }
          : item,
      ),
    }));
    const report = evaluateAgainst("optimism", [rpcMethodReq("debug_traceCall")], { snapshot });
    expect(report.findings[0]).toMatchObject({ status: "BLOCKER", category: "RPC" });
  });

  it("E: debug_traceCall with no registry data is UNKNOWN", () => {
    const report = evaluateAgainst("optimism", [rpcMethodReq("debug_traceCall")]);
    expect(report.findings[0]?.status).toBe("UNKNOWN");
    expect(report.counts.blocker).toBe(0);
  });

  it("F: source chain ID vs different target is WARNING, not BLOCKER", () => {
    const report = evaluateAgainst("optimism", [chainIdReq("8453")]);
    expect(report.findings[0]).toMatchObject({
      status: "WARNING",
      category: "CONFIGURATION",
      remediationType: "CONFIG_CHANGE",
    });
    expect(report.findings[0]?.summary).toContain("10");
  });

  it("G: canonical Permit2 on source and target is PASS", () => {
    const report = evaluateAgainst("optimism", [
      requirement({
        category: "PROTOCOL",
        key: "PERMIT2",
        detectedValue: PERMIT2,
        normalizedValue: "PERMIT2",
      }),
    ]);
    expect(report.findings[0]?.status).toBe("PASS");
  });

  it("same OP-stack WETH address across Base and Optimism is PASS", () => {
    const report = evaluateAgainst("optimism", [tokenReq("WETH", OP_STACK_WETH)]);
    expect(report.findings[0]?.status).toBe("PASS");
  });

  it("chain ID that matches neither source nor target is a source mismatch WARNING", () => {
    const report = evaluateAgainst("optimism", [chainIdReq("42161")]);
    expect(report.findings[0]?.title).toBe("Source chain configuration mismatch");
    expect(report.findings[0]?.registryEvidence).toMatchObject({
      code: "SOURCE_CHAIN_CONFIGURATION_MISMATCH",
    });
  });

  it("frontend chain config is categorized as FRONTEND", () => {
    const report = evaluateAgainst("optimism", [chainIdReq("8453", "app/wagmi.ts")]);
    expect(report.findings[0]?.category).toBe("FRONTEND");
  });

  it("specific Chainlink feed stays UNKNOWN when only generic Chainlink is known", () => {
    const report = evaluateAgainst("optimism", [
      requirement({
        category: "ORACLE",
        key: "CHAINLINK_PRICE_FEED:BTC/USD",
        detectedValue: "BTC/USD",
        normalizedValue: "BTC/USD",
      }),
    ]);
    expect(report.findings[0]?.status).toBe("UNKNOWN");
  });

  it("Chainlink Functions is PASS on Optimism from official router data", () => {
    const report = evaluateAgainst("optimism", [protocolReq("CHAINLINK_FUNCTIONS", "ORACLE")]);
    expect(report.findings[0]?.status).toBe("PASS");
    expect(report.findings[0]?.targetValue?.toLowerCase()).toBe(
      "0xaa8aaa682c9ef150c0c8e96a8d60945bcb21faad",
    );
  });

  it("ETH/USD feed is PASS on Base when declared available", () => {
    const report = evaluateAgainst("base", [
      requirement({
        category: "ORACLE",
        key: "CHAINLINK_PRICE_FEED:ETH/USD",
        detectedValue: "ETH/USD",
        normalizedValue: "ETH/USD",
      }),
    ]);
    expect(report.findings[0]?.status).toBe("PASS");
  });

  it("Uniswap V3 unknown is not replaced by Uniswap V2", () => {
    const snapshot = mutateSnapshot("ethereum", (current) => ({
      ...current,
      protocols: current.protocols.map((item) =>
        item.id === "UNISWAP_V3" ? { ...item, availability: "UNKNOWN" as const } : item,
      ),
    }));
    const report = evaluateAgainst("ethereum", [protocolReq("UNISWAP_V3")], { snapshot });
    expect(report.findings[0]?.status).toBe("UNKNOWN");
    expect(report.findings[0]?.summary).toContain("UNISWAP_V2");
  });

  it("skips standard eth_getLogs so reports are not flooded with trivial PASS rows", () => {
    const report = evaluateAgainst("optimism", [rpcMethodReq("eth_getLogs")]);
    expect(report.findings).toHaveLength(0);
  });

  it("unknown hardcoded address is UNKNOWN and does not invent an equivalent", () => {
    const report = evaluateAgainst("optimism", [
      requirement({
        category: "CONFIGURATION",
        key: "UNKNOWN_EVM_ADDRESS",
        requirementType: "UNKNOWN_EVM_ADDRESS",
        detectedValue: "0x1111111111111111111111111111111111111111",
        normalizedValue: "0x1111111111111111111111111111111111111111",
        confidence: "UNKNOWN",
      }),
    ]);
    expect(report.findings[0]?.status).toBe("UNKNOWN");
    expect(report.findings[0]?.targetValue).toBeNull();
  });

  it("LayerZero unknown on emerging targets is UNKNOWN", () => {
    const report = evaluateAgainst("unichain", [protocolReq("LAYERZERO", "CROSS_CHAIN")]);
    expect(report.findings[0]?.status).toBe("UNKNOWN");
  });

  it("network env keys are configuration warnings, not blockers", () => {
    const report = evaluateAgainst("optimism", [
      requirement({
        category: "CONFIGURATION",
        key: "ENV_KEY",
        detectedValue: "SEPOLIA_RPC_URL",
        normalizedValue: "SEPOLIA_RPC_URL",
        evidenceFilePaths: [".env.example"],
      }),
    ]);
    expect(report.findings[0]).toMatchObject({
      status: "WARNING",
      category: "CONFIGURATION",
      remediationType: "CONFIG_CHANGE",
    });
  });

  it("treats project deployments as warnings, not unknowns", () => {
    const report = evaluateAgainst("optimism", [
      requirement({
        category: "CONFIGURATION",
        key: "PROJECT_DEPLOYMENT",
        requirementType: "PROJECT_DEPLOYMENT",
        detectedValue: "0x2222222222222222222222222222222222222222",
        normalizedValue: "IndexFactory",
      }),
    ]);
    expect(report.findings[0]).toMatchObject({
      status: "WARNING",
      ruleId: "project-deployment",
      remediationType: "CONFIG_CHANGE",
    });
    expect(report.findings[0]?.title).toContain("IndexFactory");
    expect(report.findings[0]?.registryEvidence).toMatchObject({
      nextAction: "VERIFY_PROTOCOL_DEPLOYMENT",
    });
  });

  it("maps USDC environment keys to token remaps instead of unmapped UNKNOWN", () => {
    const report = evaluateAgainst("optimism", [
      requirement({
        category: "CONFIGURATION",
        key: "ENV_KEY",
        detectedValue: "ARBITRUM_USDC_ADDRESS",
        normalizedValue: "ARBITRUM_USDC_ADDRESS=[REDACTED]",
        evidenceFilePaths: [".env.example"],
      }),
    ]);
    expect(report.findings[0]).toMatchObject({
      status: "WARNING",
      category: "TOKENS",
      remediationType: "ADDRESS_MAPPING",
    });
  });

  it("skips unrelated decimals env keys", () => {
    const report = evaluateAgainst("optimism", [
      requirement({
        category: "CONFIGURATION",
        key: "ENV_KEY",
        detectedValue: "USDC_DECIMALS",
        normalizedValue: "USDC_DECIMALS=6",
      }),
    ]);
    expect(report.findings).toHaveLength(0);
  });

  it("does not treat .env private-key hex as an unmapped contract", () => {
    const report = evaluateAgainst("optimism", [
      requirement({
        category: "CONFIGURATION",
        key: "UNKNOWN_EVM_ADDRESS",
        requirementType: "UNKNOWN_EVM_ADDRESS",
        detectedValue: "0xAc0974BeC39A17e36bA4a6b4D238fF944BacB478",
        normalizedValue: "0xAc0974BeC39A17e36bA4a6b4D238fF944BacB478",
        confidence: "UNKNOWN",
        evidenceFilePaths: [".env.example"],
      }),
    ]);
    expect(report.findings).toHaveLength(0);
  });
});
