const HEX_CHAIN_ID = /^0x[0-9a-fA-F]+$/;

export function parseChainId(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 0xffffffff) {
    return value;
  }
  if (typeof value === "bigint" && value > 0n && value <= 0xffffffffn) {
    return Number(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (HEX_CHAIN_ID.test(trimmed)) {
      const parsed = Number.parseInt(trimmed, 16);
      if (parsed > 0 && parsed <= 0xffffffff) {
        return parsed;
      }
    }
    if (/^[1-9][0-9]*$/.test(trimmed)) {
      const parsed = Number.parseInt(trimmed, 10);
      if (parsed > 0 && parsed <= 0xffffffff) {
        return parsed;
      }
    }
  }
  throw new Error("chain ID is invalid");
}

export function chainIdToHex(chainId: number): `0x${string}` {
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error("chain ID is invalid");
  }
  return `0x${chainId.toString(16)}`;
}

export const WELL_KNOWN_CHAIN_IDS = {
  ethereum: 1,
  sepolia: 11_155_111,
  optimism: 10,
  optimismSepolia: 11_155_420,
  base: 8_453,
  baseSepolia: 84_532,
  arbitrumOne: 42_161,
  arbitrumSepolia: 421_614,
} as const;
