import type { CapabilityAvailability, CapabilityProvenance } from "@chainport/shared";

import type {
  OracleFeedCapability,
  ProtocolCapability,
  RpcMethodCapability,
  TokenCapability,
} from "./compatibility-types.js";

const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const OP_STACK_WETH = "0x4200000000000000000000000000000000000006";

const STANDARD_RPC_METHODS = [
  "eth_call",
  "eth_getLogs",
  "eth_estimateGas",
  "eth_getCode",
  "eth_getStorageAt",
  "eth_feeHistory",
] as const;

const DEBUG_RPC_METHODS = ["debug_traceCall", "debug_traceTransaction"] as const;

function token(
  symbol: TokenCapability["symbol"],
  availability: CapabilityAvailability,
  provenance: CapabilityProvenance,
  address: string | null = null,
): TokenCapability {
  return { symbol, availability, provenance, address };
}

function protocol(
  id: string,
  availability: CapabilityAvailability,
  provenance: CapabilityProvenance,
  address: string | null = null,
): ProtocolCapability {
  return { id, availability, provenance, address };
}

function feed(
  pair: string,
  availability: CapabilityAvailability,
  provenance: CapabilityProvenance,
  address: string | null = null,
): OracleFeedCapability {
  return { id: `CHAINLINK_PRICE_FEED:${pair}`, pair, availability, provenance, address };
}

function unknownToken(symbol: TokenCapability["symbol"]): TokenCapability {
  return token(symbol, "UNKNOWN", "UNKNOWN");
}

function availableToken(symbol: TokenCapability["symbol"], address: string): TokenCapability {
  return token(symbol, "AVAILABLE", "VERIFIED", address);
}

const LINK_ADDRESSES: Record<string, string> = {
  ethereum: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  sepolia: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
  base: "0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196",
  "base-sepolia": "0xE4aB69C077896252FAFBD49EFD26B5D171A32410",
  optimism: "0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6",
  "optimism-sepolia": "0xE4aB69C077896252FAFBD49EFD26B5D171A32410",
  "arbitrum-one": "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4",
  "arbitrum-sepolia": "0xb1D4538B4571d411F07960EF2838Ce337FE1E80E",
};

const FUNCTIONS_ROUTERS: Record<string, string> = {
  ethereum: "0x65Dcc24F8ff9e51F10DCc7Ed1e4e2A61e6E14bd6",
  sepolia: "0xb83E47C2bC239B3bf370bc41e1459A34b41238D0",
  base: "0xf9b8fc078197181c841c296c876945aaa425b278",
  "base-sepolia": "0xf9B8fc078197181C841c296C876945aaa425B278",
  optimism: "0xaA8AaA682C9eF150C0C8E96a8D60945BCB21faad",
  "optimism-sepolia": "0xC17094E3A1348E5C7544D4fF8A36c28f2C6AAE28",
  "arbitrum-one": "0x97083e831f8f0638855e2a515c90edcf158df238",
  "arbitrum-sepolia": "0x234a5fb5Bd614a7AA2FfAB244D603abFA0Ac5C5C",
};

const TOKENS: Record<string, readonly TokenCapability[]> = {
  ethereum: [
    availableToken("USDC", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
    availableToken("USDT", "0xdAC17F958D2ee523a2206206994597C13D831ec7"),
    availableToken("WETH", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
    availableToken("LINK", LINK_ADDRESSES.ethereum ?? "0x514910771AF9Ca656af840dff83E8264EcF986CA"),
  ],
  sepolia: [
    availableToken("USDC", "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"),
    unknownToken("USDT"),
    availableToken("WETH", "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"),
    availableToken("LINK", LINK_ADDRESSES.sepolia ?? "0x779877A7B0D9E8603169DdbD7836e478b4624789"),
  ],
  base: [
    availableToken("USDC", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
    availableToken("USDT", "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2"),
    availableToken("WETH", OP_STACK_WETH),
    availableToken("LINK", LINK_ADDRESSES.base ?? "0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196"),
  ],
  "base-sepolia": [
    availableToken("USDC", "0x036CbD53842c5426634e7929541eC2318f3dCF7e"),
    unknownToken("USDT"),
    availableToken("WETH", OP_STACK_WETH),
    availableToken(
      "LINK",
      LINK_ADDRESSES["base-sepolia"] ?? "0xE4aB69C077896252FAFBD49EFD26B5D171A32410",
    ),
  ],
  optimism: [
    availableToken("USDC", "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85"),
    availableToken("USDT", "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58"),
    availableToken("WETH", OP_STACK_WETH),
    availableToken("LINK", LINK_ADDRESSES.optimism ?? "0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6"),
  ],
  "optimism-sepolia": [
    availableToken("USDC", "0x5fd84259d66Cd46123540766Be93DFE6D43130D7"),
    unknownToken("USDT"),
    availableToken("WETH", OP_STACK_WETH),
    availableToken(
      "LINK",
      LINK_ADDRESSES["optimism-sepolia"] ?? "0xE4aB69C077896252FAFBD49EFD26B5D171A32410",
    ),
  ],
  "arbitrum-one": [
    availableToken("USDC", "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"),
    availableToken("USDT", "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"),
    availableToken("WETH", "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"),
    availableToken(
      "LINK",
      LINK_ADDRESSES["arbitrum-one"] ?? "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4",
    ),
  ],
  "arbitrum-sepolia": [
    availableToken("USDC", "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d"),
    unknownToken("USDT"),
    unknownToken("WETH"),
    availableToken(
      "LINK",
      LINK_ADDRESSES["arbitrum-sepolia"] ?? "0xb1D4538B4571d411F07960EF2838Ce337FE1E80E",
    ),
  ],
  linea: [
    availableToken("USDC", "0x176211869cA2b568f2A7D4EE941E073a821EE1ff"),
    unknownToken("USDT"),
    availableToken("WETH", "0xe5D7C2a44FfDDf6b295A6155ddE6b0318d1344c3"),
    unknownToken("LINK"),
  ],
  scroll: [
    availableToken("USDC", "0x06eFdBFf2a14a7c8E0EC2cF66dE8c9B1204A562a"),
    unknownToken("USDT"),
    availableToken("WETH", "0x5300000000000000000000000000000000000004"),
    unknownToken("LINK"),
  ],
};

const MATURE_KEYS = new Set([
  "ethereum",
  "sepolia",
  "base",
  "base-sepolia",
  "optimism",
  "optimism-sepolia",
  "arbitrum-one",
  "arbitrum-sepolia",
]);

const UNISWAP_V3_DECLARED = new Set([
  "ethereum",
  "sepolia",
  "base",
  "base-sepolia",
  "optimism",
  "optimism-sepolia",
  "arbitrum-one",
  "arbitrum-sepolia",
  "linea",
  "scroll",
  "unichain",
]);

const UNISWAP_V2_DECLARED = new Set(["ethereum", "optimism", "arbitrum-one"]);

const LAYERZERO_DECLARED = new Set([
  "ethereum",
  "sepolia",
  "base",
  "base-sepolia",
  "optimism",
  "optimism-sepolia",
  "arbitrum-one",
  "arbitrum-sepolia",
  "linea",
  "scroll",
]);

const ETH_USD_DECLARED = new Set(["ethereum", "base", "optimism", "arbitrum-one"]);

export function tokensForChain(chainKey: string): readonly TokenCapability[] {
  return (
    TOKENS[chainKey] ?? [
      unknownToken("USDC"),
      unknownToken("USDT"),
      unknownToken("WETH"),
      unknownToken("LINK"),
    ]
  );
}

export function rpcMethodsForChain(): readonly RpcMethodCapability[] {
  return [
    ...STANDARD_RPC_METHODS.map(
      (method): RpcMethodCapability => ({
        method,
        availability: "AVAILABLE",
        provenance: "VERIFIED",
      }),
    ),
    ...DEBUG_RPC_METHODS.map(
      (method): RpcMethodCapability => ({
        method,
        availability: "UNKNOWN",
        provenance: "UNKNOWN",
      }),
    ),
  ];
}

export function protocolsForChain(chainKey: string): readonly ProtocolCapability[] {
  const mature = MATURE_KEYS.has(chainKey);
  return [
    protocol(
      "PERMIT2",
      mature ? "AVAILABLE" : "UNKNOWN",
      mature ? "VERIFIED" : "UNKNOWN",
      mature ? PERMIT2 : null,
    ),
    protocol("SAFE", mature ? "AVAILABLE" : "UNKNOWN", mature ? "DECLARED" : "UNKNOWN"),
    protocol(
      "UNISWAP_V3",
      UNISWAP_V3_DECLARED.has(chainKey) ? "AVAILABLE" : "UNKNOWN",
      UNISWAP_V3_DECLARED.has(chainKey) ? "DECLARED" : "UNKNOWN",
    ),
    protocol(
      "UNISWAP_V2",
      UNISWAP_V2_DECLARED.has(chainKey) ? "AVAILABLE" : "UNKNOWN",
      UNISWAP_V2_DECLARED.has(chainKey) ? "DECLARED" : "UNKNOWN",
    ),
    protocol("UNISWAP_V4", "UNKNOWN", "UNKNOWN"),
    protocol(
      "LAYERZERO",
      LAYERZERO_DECLARED.has(chainKey) ? "AVAILABLE" : "UNKNOWN",
      LAYERZERO_DECLARED.has(chainKey) ? "DECLARED" : "UNKNOWN",
    ),
    protocol(
      "CHAINLINK_FUNCTIONS",
      FUNCTIONS_ROUTERS[chainKey] !== undefined ? "AVAILABLE" : "UNKNOWN",
      FUNCTIONS_ROUTERS[chainKey] !== undefined ? "DECLARED" : "UNKNOWN",
      FUNCTIONS_ROUTERS[chainKey] ?? null,
    ),
  ];
}

export function feedsForChain(chainKey: string): readonly OracleFeedCapability[] {
  if (ETH_USD_DECLARED.has(chainKey)) {
    return [feed("ETH/USD", "AVAILABLE", "DECLARED")];
  }
  return [feed("ETH/USD", "UNKNOWN", "UNKNOWN")];
}

export const CANONICAL_PERMIT2_ADDRESS = PERMIT2;
export const STANDARD_JSON_RPC_METHODS: readonly string[] = STANDARD_RPC_METHODS;
