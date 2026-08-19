import { checksumAddress } from "@chainport/evm";

export interface KnownAddress {
  address: string;
  symbol: string;
  key: string;
  category: "TOKEN" | "PROTOCOL";
}

const RAW: Array<[string, KnownAddress["symbol"], KnownAddress["key"], KnownAddress["category"]]> =
  [
    ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "USDC", "USDC", "TOKEN"],
    ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", "USDC", "TOKEN"],
    ["0xaf88d065e77c8cC2239327C5EDb3A432268e5831", "USDC", "USDC", "TOKEN"],
    ["0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", "USDC", "USDC", "TOKEN"],
    ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "USDT", "USDT", "TOKEN"],
    ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "WETH", "WETH", "TOKEN"],
    ["0x4200000000000000000000000000000000000006", "WETH", "WETH", "TOKEN"],
    ["0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", "WETH", "WETH", "TOKEN"],
    ["0x000000000022D473030F116dDEE9F6B43aC78BA3", "Permit2", "PERMIT2", "PROTOCOL"],
  ];

export const KNOWN_ADDRESSES = new Map(
  RAW.map(([address, symbol, key, category]) => [
    checksumAddress(address).toLowerCase(),
    { address: checksumAddress(address), symbol, key, category } satisfies KnownAddress,
  ]),
);

export function classifyKnownAddress(address: string): KnownAddress | undefined {
  try {
    return KNOWN_ADDRESSES.get(checksumAddress(address).toLowerCase());
  } catch {
    return undefined;
  }
}
