import { getChainByKey, listChainSummaries, toChainSummary } from "@chainport/chain-registry";

import { ApiRequestError } from "../errors.js";
import type { ApiInstance } from "../types.js";

export function registerChainRoutes(app: ApiInstance): void {
  app.get("/v1/chains", () => ({
    data: listChainSummaries(),
  }));

  app.get<{ Params: { key: string } }>("/v1/chains/:key", (request) => {
    const chain = getChainByKey(request.params.key);
    if (chain === undefined) {
      throw new ApiRequestError(404, "CHAIN_NOT_FOUND", "Chain not found");
    }
    return {
      data: {
        ...toChainSummary(chain),
        parentChainKey: chain.parentChainKey ?? null,
        testnetOf: chain.testnetOf ?? null,
        nativeCurrency: chain.nativeCurrency,
        rpcUrls: chain.rpcUrls,
        explorers: chain.explorers,
        capabilities: chain.capabilities,
        infrastructure: chain.infrastructure,
      },
    };
  });
}
