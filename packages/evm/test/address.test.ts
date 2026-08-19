import { describe, expect, it } from "vitest";

import { checksumAddress, extractAddresses, isEvmAddress } from "../src/index.js";

const vitalik = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

describe("EVM addresses", () => {
  it("checksums mixed-case addresses", () => {
    expect(checksumAddress(vitalik.toLowerCase())).toBe(vitalik);
    expect(isEvmAddress(vitalik)).toBe(true);
    expect(isEvmAddress("0x1234")).toBe(false);
  });

  it("extracts unique checksummed addresses from text", () => {
    const text = `const USDC = "${vitalik.toLowerCase()}"; const again = "${vitalik}";`;
    expect(extractAddresses(text)).toEqual([vitalik]);
  });
});
