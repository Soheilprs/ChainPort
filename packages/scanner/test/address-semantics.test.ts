import { describe, expect, it } from "vitest";

import { classifyAddressContext } from "../src/catalog/address-semantics.js";

const UNKNOWN = "0x1111111111111111111111111111111111111111";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

describe("address semantics", () => {
  it("classifies known token addresses from the catalog", () => {
    expect(
      classifyAddressContext({ address: BASE_USDC, names: [], contractNames: [] }),
    ).toMatchObject({ kind: "named", key: "USDC" });
  });

  it("classifies Uniswap factory struct fields without a Uniswap prefix", () => {
    expect(
      classifyAddressContext({
        address: UNKNOWN,
        names: ["v3Factory", "v2Factory"],
        contractNames: ["UniversalRouter"],
      }),
    ).toMatchObject({ kind: "named", key: "UNISWAP_V3" });
  });

  it("classifies Uniswap WETH9 and position/pool manager identifiers", () => {
    expect(
      classifyAddressContext({
        address: UNKNOWN,
        names: ["weth9"],
        contractNames: ["UniversalRouter"],
      }),
    ).toMatchObject({ kind: "named", key: "WETH" });
    expect(
      classifyAddressContext({
        address: UNKNOWN,
        names: ["v3NFTPositionManager"],
        contractNames: ["UniversalRouter"],
      }),
    ).toMatchObject({ kind: "named", key: "UNISWAP_V3" });
    expect(
      classifyAddressContext({
        address: UNKNOWN,
        names: ["v4PoolManager"],
        contractNames: ["UniversalRouter"],
      }),
    ).toMatchObject({ kind: "named", key: "UNISWAP_V4" });
  });

  it("classifies LayerZero endpoint JSON catalogs from the filename", () => {
    expect(
      classifyAddressContext({
        address: UNKNOWN,
        names: ["layerzeroEndpoints", "ethereum"],
        contractNames: [],
      }),
    ).toMatchObject({ kind: "named", key: "LAYERZERO" });
  });

  it("classifies USDC from an identifier when the address is otherwise unknown", () => {
    expect(
      classifyAddressContext({
        address: UNKNOWN,
        names: ["UsdcAddresses"],
        contractNames: [],
      }),
    ).toMatchObject({ kind: "named", key: "USDC" });
  });

  it("classifies project deployments from contract names and address-book identifiers", () => {
    expect(
      classifyAddressContext({
        address: UNKNOWN,
        names: ["IndexFactoryAddresses", "sepolia"],
        contractNames: ["IndexFactory", "OrderManager"],
      }),
    ).toEqual({ kind: "project", name: "IndexFactory" });
  });

  it("does not create an empty project-deployment name", () => {
    expect(
      classifyAddressContext({
        address: UNKNOWN,
        names: ["Addresses", "sepolia"],
        contractNames: ["IndexFactory"],
      }),
    ).toEqual({ kind: "unknown" });
  });

  it("keeps unidentified addresses unknown", () => {
    expect(
      classifyAddressContext({
        address: UNKNOWN,
        names: ["value"],
        contractNames: ["IndexFactory"],
      }),
    ).toEqual({ kind: "unknown" });
  });
});
