import { describe, expect, it } from "vitest";

import {
  CHAINS,
  getChainByChainId,
  getChainByKey,
  listSourceChains,
  listTargetChains,
  requireChainByKey,
} from "../src/index.js";

describe("chain registry", () => {
  it("contains unique keys and chain IDs", () => {
    const keys = CHAINS.map((chain) => chain.key);
    const ids = CHAINS.map((chain) => chain.chainId);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes the core source networks from the product brief", () => {
    expect(getChainByKey("ethereum")?.chainId).toBe(1);
    expect(getChainByChainId(8453)?.key).toBe("base");
    expect(getChainByChainId(42161)?.key).toBe("arbitrum-one");
    expect(getChainByChainId(10)?.key).toBe("optimism");
  });

  it("separates source and target roles without inventing capabilities", () => {
    const sources = listSourceChains().map((chain) => chain.key);
    const targets = listTargetChains().map((chain) => chain.key);
    expect(sources).toEqual(
      expect.arrayContaining(["ethereum", "base", "arbitrum-one", "optimism"]),
    );
    expect(targets).toEqual(expect.arrayContaining(["base", "unichain", "scroll"]));
    expect(getChainByKey("ethereum")?.roles).toEqual(["source"]);
  });

  it("keeps public RPC URLs as catalog metadata", () => {
    const base = requireChainByKey("base");
    expect(base.rpcUrls.length).toBeGreaterThan(0);
    for (const url of base.rpcUrls) {
      expect(url.startsWith("http")).toBe(true);
    }
  });

  it("marks emerging-chain infrastructure as unknown instead of available by default", () => {
    const unichain = requireChainByKey("unichain");
    expect(unichain.infrastructure.oracles.some((entry) => entry.status === "unknown")).toBe(true);
  });

  it("throws for unknown keys", () => {
    expect(() => requireChainByKey("not-a-chain")).toThrow(/unknown chain key/);
  });
});
