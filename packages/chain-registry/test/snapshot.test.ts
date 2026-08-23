import { describe, expect, it } from "vitest";

import { hashTargetSnapshot, REGISTRY_VERSION, snapshotForChainKey } from "../src/index.js";

describe("target capability snapshots", () => {
  it("versions the in-code registry", () => {
    expect(REGISTRY_VERSION).toBe("2");
  });

  it("hashes canonical capability data independently of key order", () => {
    const hashed = snapshotForChainKey("base");
    const again = hashTargetSnapshot({
      ...hashed.snapshot,
      tokens: [...hashed.snapshot.tokens].reverse(),
      rpcMethods: [...hashed.snapshot.rpcMethods].reverse(),
    });
    expect(hashed.hash).toBe(again.hash);
    expect(hashed.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("records official LINK and Chainlink Functions data as declared/verified, not guessed", () => {
    const optimism = snapshotForChainKey("optimism");
    expect(optimism.snapshot.tokens.find((item) => item.symbol === "LINK")).toMatchObject({
      availability: "AVAILABLE",
      provenance: "VERIFIED",
      address: "0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6",
    });
    expect(
      optimism.snapshot.protocols.find((item) => item.id === "CHAINLINK_FUNCTIONS"),
    ).toMatchObject({
      availability: "AVAILABLE",
      provenance: "DECLARED",
    });
    const unichain = snapshotForChainKey("unichain");
    expect(
      unichain.snapshot.protocols.find((item) => item.id === "CHAINLINK_FUNCTIONS")?.availability,
    ).toBe("UNKNOWN");
  });

  it("keeps Base USDC verified and Unichain USDC unknown", () => {
    const base = snapshotForChainKey("base");
    const unichain = snapshotForChainKey("unichain");
    expect(base.snapshot.tokens.find((item) => item.symbol === "USDC")).toMatchObject({
      availability: "AVAILABLE",
      provenance: "VERIFIED",
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    });
    expect(unichain.snapshot.tokens.find((item) => item.symbol === "USDC")?.availability).toBe(
      "UNKNOWN",
    );
  });

  it("does not claim debug_traceCall support from EVM compatibility", () => {
    const optimism = snapshotForChainKey("optimism");
    const debug = optimism.snapshot.rpcMethods.find((item) => item.method === "debug_traceCall");
    expect(debug).toMatchObject({ availability: "UNKNOWN", provenance: "UNKNOWN" });
  });

  it("marks Chainlink unknown on emerging targets instead of unavailable", () => {
    const unichain = snapshotForChainKey("unichain");
    expect(unichain.snapshot.protocols.find((item) => item.id === "CHAINLINK")).toMatchObject({
      availability: "UNKNOWN",
    });
  });

  it("changes the snapshot hash when a capability changes", () => {
    const base = snapshotForChainKey("base");
    const mutated = hashTargetSnapshot({
      ...base.snapshot,
      tokens: base.snapshot.tokens.map((item) =>
        item.symbol === "USDC"
          ? { ...item, availability: "UNAVAILABLE" as const, address: null }
          : item,
      ),
    });
    expect(mutated.hash).not.toBe(base.hash);
  });
});
