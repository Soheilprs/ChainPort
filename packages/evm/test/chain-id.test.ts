import { describe, expect, it } from "vitest";

import { chainIdToHex, parseChainId, WELL_KNOWN_CHAIN_IDS } from "../src/index.js";

describe("chain IDs", () => {
  it("parses decimal, hex, and bigint forms", () => {
    expect(parseChainId(8453)).toBe(WELL_KNOWN_CHAIN_IDS.base);
    expect(parseChainId("8453")).toBe(8453);
    expect(parseChainId("0x2105")).toBe(8453);
    expect(parseChainId(8453n)).toBe(8453);
  });

  it("rejects zero, negative, and malformed values", () => {
    expect(() => parseChainId(0)).toThrow(/invalid/);
    expect(() => parseChainId("0x")).toThrow(/invalid/);
    expect(() => parseChainId("chain")).toThrow(/invalid/);
  });

  it("encodes hex chain IDs", () => {
    expect(chainIdToHex(1)).toBe("0x1");
    expect(chainIdToHex(8453)).toBe("0x2105");
  });
});
