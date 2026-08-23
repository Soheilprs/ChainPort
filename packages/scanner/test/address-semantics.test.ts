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
