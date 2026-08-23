import { getAddress, isAddress, isHash } from "viem";

export type HexAddress = `0x${string}`;

export function isEvmAddress(value: unknown): value is HexAddress {
  return typeof value === "string" && isAddress(value, { strict: false });
}

export function checksumAddress(value: string): HexAddress {
  if (!isEvmAddress(value)) {
    throw new Error("value is not an EVM address");
  }
  return getAddress(value);
}

export function isTransactionHash(value: unknown): value is HexAddress {
  return typeof value === "string" && isHash(value);
}

const ADDRESS_LITERAL = /0x[a-fA-F0-9]{40}(?![a-fA-F0-9])/g;

const SENTINELS = new Set(
  [
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000001",
    "0x0000000000000000000000000000000000000002",
    "0x0000000000000000000000000000000000000003",
    "0x0000000000000000000000000000000000000004",
    "0x0000000000000000000000000000000000000005",
    "0x0000000000000000000000000000000000000006",
    "0x0000000000000000000000000000000000000007",
    "0x0000000000000000000000000000000000000008",
    "0x0000000000000000000000000000000000000009",
    "0x000000000000000000000000000000000000000a",
    "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    "0x000000000000000000000000000000000000dead",
  ].map((value) => value.toLowerCase()),
);

export function isSentinelAddress(value: string): boolean {
  try {
    return SENTINELS.has(checksumAddress(value).toLowerCase());
  } catch {
    return SENTINELS.has(value.toLowerCase());
  }
}

export function extractAddresses(text: string): HexAddress[] {
  const matches = text.match(ADDRESS_LITERAL) ?? [];
  const unique = new Set<HexAddress>();
  for (const match of matches) {
    if (isEvmAddress(match) && !isSentinelAddress(match)) {
      unique.add(checksumAddress(match));
    }
  }
  return [...unique];
}
