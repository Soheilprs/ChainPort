import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { analyzeRepository, SCANNER_VERSION } from "../src/index.js";

const fixtures = path.join(fileURLToPath(new URL(".", import.meta.url)), "fixtures");

describe("analyzeRepository", () => {
  it("detects Foundry, Chainlink, USDC, and a Base chain id", async () => {
    const result = await analyzeRepository(path.join(fixtures, "foundry"));
    expect(result.scannerVersion).toBe(SCANNER_VERSION);
    expect(result.components.some((item) => item.name === "foundry")).toBe(true);
    expect(result.requirements.some((item) => item.key === "CHAINLINK")).toBe(true);
    expect(result.requirements.some((item) => item.key === "USDC")).toBe(true);
    expect(
      result.requirements.some(
        (item) => item.key === "HARDCODED_CHAIN_ID" && item.detectedValue === "8453",
      ),
    ).toBe(true);
    expect(result.components.some((item) => item.name === "FeedConsumer")).toBe(true);
  });

  it("detects Hardhat without executing the config file", async () => {
    const root = path.join(fixtures, "hardhat");
    const result = await analyzeRepository(root);
    expect(result.components.some((item) => item.name === "hardhat")).toBe(true);
    expect(result.requirements.some((item) => item.key === "HARDCODED_CHAIN_ID")).toBe(true);
    expect(
      result.requirements.some(
        (item) => item.key === "RPC_URL" && item.normalizedValue.includes("[REDACTED]"),
      ),
    ).toBe(true);
    await expect(access(path.join(root, "SCANNER_EXECUTED"))).rejects.toThrow();
  });

  it("detects a full-stack viem/wagmi app", async () => {
    const result = await analyzeRepository(path.join(fixtures, "fullstack"));
    expect(result.requirements.some((item) => item.key === "VIEM")).toBe(true);
    expect(result.requirements.some((item) => item.key === "WAGMI")).toBe(true);
    expect(result.components.some((item) => item.name === "pnpm")).toBe(true);
    expect(result.requirements.some((item) => item.key === "PERMIT2")).toBe(true);
    expect(result.requirements.some((item) => item.normalizedValue === "eth_getLogs")).toBe(true);
    expect(result.requirements.some((item) => item.key === "ENV_KEY")).toBe(true);
  });

  it("normalizes address-book and identifier context without hashing bytes32 or OpenZeppelin history", async () => {
    const result = await analyzeRepository(path.join(fixtures, "quality"));
    expect(result.scannerVersion).toBe(SCANNER_VERSION);
    expect(result.files.some((file) => file.path.includes(".openzeppelin"))).toBe(false);
    expect(
      result.requirements.some(
        (item) =>
          item.key === "UNKNOWN_EVM_ADDRESS" &&
          item.detectedValue.toLowerCase().startsWith("0x5f4253eb"),
      ),
    ).toBe(false);
    expect(
      result.requirements.some(
        (item) => item.key === "USDC" && item.requirementType === "NAMED_ADDRESS",
      ),
    ).toBe(true);
    expect(
      result.requirements.some(
        (item) => item.key === "PROJECT_DEPLOYMENT" && item.normalizedValue === "IndexFactory",
      ),
    ).toBe(true);
    expect(
      result.requirements.some(
        (item) => item.detectedValue === "0x4444444444444444444444444444444444444444",
      ),
    ).toBe(false);
    expect(result.requirements.some((item) => item.detectedValue === "DATABASE_URL")).toBe(false);
    expect(result.requirements.some((item) => item.detectedValue === "USDC_DECIMALS")).toBe(false);
    expect(result.requirements.some((item) => item.detectedValue === "USDC_ADDRESS")).toBe(true);
  });

  it("reads JSON address-book keys and Solidity struct fields as identifiers", async () => {
    const result = await analyzeRepository(path.join(fixtures, "quality"));
    expect(
      result.requirements.some(
        (item) => item.key === "LAYERZERO" && item.requirementType === "PROTOCOL",
      ),
    ).toBe(true);
    expect(
      result.requirements.some(
        (item) => item.key === "UNISWAP_V3" && item.detectedValue.startsWith("0x3333"),
      ),
    ).toBe(true);
    expect(
      result.requirements.some(
        (item) => item.key === "WETH" && item.detectedValue.startsWith("0x5555"),
      ),
    ).toBe(true);
    expect(
      result.requirements.some(
        (item) => item.key === "UNISWAP_V4" && item.detectedValue.startsWith("0x6666"),
      ),
    ).toBe(true);
  });

  it("does not treat markdown noise as high-confidence infrastructure", async () => {
    const result = await analyzeRepository(path.join(fixtures, "noisy"));
    expect(result.requirements.some((item) => item.key === "USDC")).toBe(false);
    expect(result.requirements.some((item) => item.key === "RPC_METHOD")).toBe(false);
    const env = result.requirements.find((item) => item.detectedValue === "API_KEY");
    expect(env?.normalizedValue).toContain("[REDACTED]");
    expect(JSON.stringify(result)).not.toContain("super-secret-live-key-value");
  });
});
