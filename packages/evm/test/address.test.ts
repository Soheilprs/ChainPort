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

  it("does not treat transaction hashes or bytes32 values as addresses", () => {
    const txHash = "0x5f4253ebb09e9b5f4fd60ae91ddd68e06cb77ef2b2185c45543aa6e79b65e58d";
    const slot = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    expect(extractAddresses(`"txHash": "${txHash}"`)).toEqual([]);
    expect(extractAddresses(`bytes32 constant SLOT = ${slot};`)).toEqual([]);
  });

  it("ignores the zero address and native-token sentinel", () => {
    expect(extractAddresses("address a = 0x0000000000000000000000000000000000000000;")).toEqual([]);
    expect(extractAddresses("address a = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;")).toEqual([]);
  });
});
