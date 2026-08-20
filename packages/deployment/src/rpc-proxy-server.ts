import { confirmTargetRpc } from "./target.js";
import { createRpcProxy } from "./rpc-proxy.js";
import { getChainByKey } from "@chainport/chain-registry";

const upstream = process.env.UPSTREAM_RPC_URL ?? "";
const expected = Number(process.env.EXPECTED_CHAIN_ID ?? "0");
const journalPath = process.env.JOURNAL_PATH ?? "/journal/rpc.jsonl";
const port = Number(process.env.LISTEN_PORT ?? "8545");

if (upstream === "" || expected === 0) {
  process.stderr.write("UPSTREAM_RPC_URL and EXPECTED_CHAIN_ID are required\n");
  process.exit(1);
}

const chainKey = process.env.TARGET_CHAIN_KEY;
if (chainKey !== undefined) {
  const chain = getChainByKey(chainKey);
  if (chain === undefined || chain.chainId !== expected) {
    process.stderr.write("registry target mismatch\n");
    process.exit(1);
  }
  if (chain.networkKind === "mainnet") {
    process.stderr.write("MAINNET_DEPLOYMENT_FORBIDDEN\n");
    process.exit(1);
  }
}

await confirmTargetRpc({
  chain: {
    key: chainKey ?? "proxy",
    name: "proxy",
    shortName: "proxy",
    chainId: expected,
    networkKind: "testnet",
    family: "ethereum",
    roles: [],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: [upstream],
    explorers: [],
    deployment: {
      enabled: true,
      environment: "TESTNET",
      confirmationCount: 1,
      verificationProvider: "none",
      maxFundingWei: "0",
      maxGasBudget: 1,
      maxTransactionCount: 1,
      maxTransactionValueWei: "0",
    },
    capabilities: {
      evmVersion: "cancun",
      eip1559: true,
      push0: true,
      transientStorage: false,
      mcopy: false,
      blobTransactions: false,
      create2: true,
      precompiles: [],
    },
    infrastructure: { oracles: [], bridges: [], indexers: [], verifiers: [] },
  },
  rpcUrl: upstream,
});

const server = createRpcProxy({
  upstreamRpcUrl: upstream,
  expectedChainId: expected,
  journalPath,
  maxBodyBytes: Number(process.env.MAX_BODY_BYTES ?? "1048576"),
  rateLimit: Number(process.env.RATE_LIMIT ?? "120"),
  timeoutMs: Number(process.env.TIMEOUT_MS ?? "30000"),
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(`chainport-rpc-proxy listening on ${port}\n`);
});
