import { describe, expect, it } from "vitest";

import { createMigrationPlan } from "../src/index.js";
import { context, finding, warning } from "./helpers.js";

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const OP_USDC = "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85";

describe("migration rules", () => {
  it("A: chain ID + single RPC + USDC remap are SAFE_AUTOMATIC", () => {
    const plan = createMigrationPlan({
      context: context(),
      findings: [
        warning("chain-id", "chain id", {
          sourceValue: "8453 (Base)",
          targetValue: "10 (OP Mainnet)",
        }),
        warning("hardcoded-rpc", "rpc", {
          sourceValue: "https://mainnet.base.org",
          targetValue: "https://mainnet.optimism.io",
          registryEvidence: { targetRpcUrls: ["https://mainnet.optimism.io"] },
        }),
        warning("token-availability", "usdc", {
          requirementKey: "USDC",
          category: "TOKENS",
          sourceValue: BASE_USDC,
          targetValue: OP_USDC,
          registryEvidence: { symbol: "USDC", provenance: "VERIFIED" },
        }),
      ],
    });
    expect(plan.counts.safeAutomatic).toBe(3);
    expect(plan.counts.blocked).toBe(0);
    expect(plan.outcome).toBe("READY_TO_APPLY");
    expect(plan.autoFixablePercent).toBe(100);
  });

  it("B: verified Chainlink feed remap is REVIEW_REQUIRED MEDIUM", () => {
    const plan = createMigrationPlan({
      context: context(),
      findings: [
        warning("oracle-availability", "feed", {
          category: "ORACLES",
          sourceValue: "ETH/USD",
          targetValue: "0x13e3Ee699D1909E989722E753853AE30b17e08c5",
          registryEvidence: { pair: "ETH/USD" },
        }),
      ],
    });
    expect(plan.actions[0]).toMatchObject({
      automationLevel: "REVIEW_REQUIRED",
      riskLevel: "MEDIUM",
      category: "ORACLE_FEED",
    });
  });

  it("C: missing required oracle is BLOCKED CRITICAL", () => {
    const plan = createMigrationPlan({
      context: context(),
      findings: [
        finding({
          ruleId: "oracle-availability",
          status: "BLOCKER",
          title: "Chainlink unavailable",
          category: "ORACLES",
          registryEvidence: { pair: "ETH/USD" },
        }),
      ],
    });
    expect(plan.actions[0]).toMatchObject({
      automationLevel: "BLOCKED",
      riskLevel: "CRITICAL",
      actionStatus: "BLOCKED",
    });
    expect(plan.outcome).toBe("BLOCKED");
    expect(plan.migrationReady).toBe(false);
  });

  it("D: unknown LayerZero stays UNKNOWN and NEEDS_VERIFICATION", () => {
    const plan = createMigrationPlan({
      context: context({ targetChainKey: "unichain", targetChainName: "Unichain" }),
      findings: [
        finding({
          ruleId: "layerzero",
          status: "UNKNOWN",
          title: "LayerZero unverified",
          category: "CROSS_CHAIN",
          requirementKey: "LAYERZERO",
        }),
      ],
    });
    expect(plan.actions[0]?.automationLevel).toBe("UNKNOWN");
    expect(plan.outcome).toBe("NEEDS_VERIFICATION");
    expect(plan.actions[0]?.description).toContain("does not mean LayerZero is unavailable");
  });

  it("E: unsupported debug RPC is BLOCKED", () => {
    const plan = createMigrationPlan({
      context: context(),
      findings: [
        finding({
          ruleId: "rpc-capability",
          status: "BLOCKER",
          title: "debug_traceCall unavailable",
          sourceValue: "debug_traceCall",
          category: "RPC",
        }),
      ],
    });
    expect(plan.actions[0]).toMatchObject({
      automationLevel: "BLOCKED",
      riskLevel: "CRITICAL",
      category: "RPC_CAPABILITY",
    });
  });

  it("F: frontend chain ID is a separate action that depends on network chain ID", () => {
    const plan = createMigrationPlan({
      context: context(),
      findings: [
        warning("chain-id", "hardhat chain id", { category: "CONFIGURATION", sourceValue: "8453" }),
        warning("chain-id", "wagmi chain id", { category: "FRONTEND", sourceValue: "8453" }),
        warning("hardcoded-rpc", "frontend rpc", {
          category: "FRONTEND",
          sourceValue: "https://mainnet.base.org",
          registryEvidence: { targetRpcUrls: ["https://mainnet.optimism.io"] },
        }),
      ],
    });
    expect(plan.actions.some((item) => item.stage === "NETWORK_CONFIGURATION")).toBe(true);
    expect(plan.actions.some((item) => item.stage === "FRONTEND_CONFIGURATION")).toBe(true);
    expect(
      plan.dependencies.some(
        (item) =>
          item.actionKey.startsWith("frontend-chain-id:") &&
          item.dependsOnKey.startsWith("chain-id:"),
      ),
    ).toBe(true);
  });

  it("merges unclassified address findings into one verification action", () => {
    const plan = createMigrationPlan({
      context: context(),
      findings: [
        finding({
          id: "f1",
          ruleId: "hardcoded-address",
          status: "UNKNOWN",
          title: "unknown a",
          sourceValue: "0x1111111111111111111111111111111111111111",
        }),
        finding({
          id: "f2",
          ruleId: "hardcoded-address",
          status: "UNKNOWN",
          title: "unknown b",
          sourceValue: "0x2222222222222222222222222222222222222222",
        }),
      ],
    });
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]?.key).toBe("unknown-address");
    expect(plan.actions[0]?.findingIds).toEqual(["f1", "f2"]);
  });

  it("G: PASS-only findings produce an empty READY_TO_APPLY plan", () => {
    const plan = createMigrationPlan({
      context: context(),
      findings: [
        finding({
          ruleId: "framework-compatibility",
          status: "PASS",
          title: "Solidity compatible",
          category: "CONTRACTS",
        }),
        finding({
          ruleId: "oracle-availability",
          status: "PASS",
          title: "Chainlink available",
          category: "ORACLES",
        }),
      ],
    });
    expect(plan.counts.total).toBe(0);
    expect(plan.outcome).toBe("READY_TO_APPLY");
    expect(plan.migrationReady).toBe(true);
    expect(plan.autoFixablePercent).toBe(100);
  });

  it("downgrades SEPOLIA-named env keys to REVIEW_REQUIRED", () => {
    const plan = createMigrationPlan({
      context: context(),
      findings: [
        warning("env-config", "sepolia rpc", {
          sourceValue: "SEPOLIA_RPC_URL",
          registryEvidence: {
            envKey: "SEPOLIA_RPC_URL",
            targetRpcUrls: ["https://mainnet.optimism.io"],
          },
        }),
      ],
    });
    expect(plan.actions[0]?.automationLevel).toBe("REVIEW_REQUIRED");
  });

  it("never substitutes USDC with USDT", () => {
    const plan = createMigrationPlan({
      context: context(),
      findings: [
        warning("token-availability", "usdc", {
          requirementKey: "USDC",
          category: "TOKENS",
          sourceValue: BASE_USDC,
          targetValue: OP_USDC,
          registryEvidence: { symbol: "USDC" },
        }),
      ],
    });
    expect(plan.actions[0]?.description).toContain("not substituted");
    expect(plan.actions[0]?.targetValue).toBe(OP_USDC);
  });

  it("marks WETH remaps REVIEW_REQUIRED", () => {
    const plan = createMigrationPlan({
      context: context(),
      findings: [
        warning("token-availability", "weth", {
          requirementKey: "WETH",
          category: "TOKENS",
          sourceValue: "0x4200000000000000000000000000000000000006",
          targetValue: "0x4200000000000000000000000000000000000006",
          registryEvidence: { symbol: "WETH" },
        }),
      ],
    });
    expect(plan.actions[0]?.automationLevel).toBe("REVIEW_REQUIRED");
  });

  it("deduplicates repeated chain ID findings into one action with all evidence", () => {
    const plan = createMigrationPlan({
      context: context(),
      findings: [
        warning("chain-id", "id a", {
          id: "a",
          evidence: [
            {
              findingId: "a",
              evidenceId: "1",
              filePath: "hardhat.config.ts",
              startLine: 22,
              excerpt: "8453",
            },
          ],
        }),
        warning("chain-id", "id b", {
          id: "b",
          evidence: [
            {
              findingId: "b",
              evidenceId: "2",
              filePath: "src/chains.ts",
              startLine: 8,
              excerpt: "8453",
            },
          ],
        }),
      ],
    });
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]?.evidence).toHaveLength(2);
    expect(plan.actions[0]?.findingIds).toEqual(["a", "b"]);
  });

  it("multiple target RPCs are REVIEW_REQUIRED rather than auto-picked", () => {
    const plan = createMigrationPlan({
      context: context({ targetRpcUrls: ["https://a", "https://b"] }),
      findings: [
        warning("hardcoded-rpc", "rpc", {
          sourceValue: "https://mainnet.base.org",
          registryEvidence: { targetRpcUrls: ["https://a", "https://b"] },
        }),
      ],
    });
    expect(plan.actions[0]?.automationLevel).toBe("REVIEW_REQUIRED");
    expect(plan.actions[0]?.description).toContain("catalogued endpoints");
  });

  it("does not recommend Pyth when Chainlink is blocked", () => {
    const plan = createMigrationPlan({
      context: context(),
      findings: [
        finding({
          ruleId: "oracle-availability",
          status: "BLOCKER",
          title: "unavailable",
          category: "ORACLES",
        }),
      ],
    });
    expect(JSON.stringify(plan)).not.toContain("Pyth");
  });
});
