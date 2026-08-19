import type { Chain } from "viem";

import type { ChainDefinition, ChainExplorer } from "./types.js";

export function publicRpcUrls(chain: Chain): readonly string[] {
  return chain.rpcUrls.default.http;
}

export function explorersFromViem(chain: Chain): readonly ChainExplorer[] {
  const explorer = chain.blockExplorers?.default;
  return explorer === undefined ? [] : [{ name: explorer.name, url: explorer.url }];
}

export function identityFromViem(
  chain: Chain,
): Pick<ChainDefinition, "chainId" | "name" | "nativeCurrency" | "rpcUrls" | "explorers"> {
  return {
    chainId: chain.id,
    name: chain.name,
    nativeCurrency: {
      name: chain.nativeCurrency.name,
      symbol: chain.nativeCurrency.symbol,
      decimals: chain.nativeCurrency.decimals,
    },
    rpcUrls: publicRpcUrls(chain),
    explorers: explorersFromViem(chain),
  };
}
