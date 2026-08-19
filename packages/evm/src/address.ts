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

export function extractAddresses(text: string): HexAddress[] {
  const matches = text.match(/0x[a-fA-F0-9]{40}/g) ?? [];
  const unique = new Set<HexAddress>();
  for (const match of matches) {
    if (isEvmAddress(match)) {
      unique.add(checksumAddress(match));
    }
  }
  return [...unique];
}
