import { jsonRpc } from "./rpc.js";

export interface ReceiptSnapshot {
  hash: string;
  status: "CONFIRMED" | "PENDING" | "REVERTED" | "UNKNOWN";
  blockNumber: number | null;
  contractAddress: string | null;
  from: string | null;
  to: string | null;
  gasUsed: string | null;
}

export async function fetchReceipt(rpcUrl: string, hash: string): Promise<ReceiptSnapshot> {
  const receipt = await jsonRpc<null | {
    status?: string;
    blockNumber?: string;
    contractAddress?: string;
    from?: string;
    to?: string;
    gasUsed?: string;
  }>(rpcUrl, "eth_getTransactionReceipt", [hash]);
  if (receipt === null) {
    return {
      hash,
      status: "PENDING",
      blockNumber: null,
      contractAddress: null,
      from: null,
      to: null,
      gasUsed: null,
    };
  }
  const success = receipt.status === "0x1";
  return {
    hash,
    status: success ? "CONFIRMED" : "REVERTED",
    blockNumber: receipt.blockNumber === undefined ? null : Number(BigInt(receipt.blockNumber)),
    contractAddress: receipt.contractAddress ?? null,
    from: receipt.from ?? null,
    to: receipt.to ?? null,
    gasUsed: receipt.gasUsed ?? null,
  };
}

export async function waitForConfirmations(input: {
  rpcUrl: string;
  hash: string;
  confirmations: number;
  timeoutMs: number;
}): Promise<ReceiptSnapshot> {
  const deadline = Date.now() + input.timeoutMs;
  let latest: ReceiptSnapshot = await fetchReceipt(input.rpcUrl, input.hash);
  while (Date.now() < deadline) {
    latest = await fetchReceipt(input.rpcUrl, input.hash);
    if (latest.status === "REVERTED") {
      return latest;
    }
    if (latest.status === "CONFIRMED" && latest.blockNumber !== null) {
      const headHex = await jsonRpc<string>(input.rpcUrl, "eth_blockNumber", []);
      const head = Number(BigInt(headHex));
      if (head - latest.blockNumber + 1 >= input.confirmations) {
        return latest;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return latest.status === "CONFIRMED" ? latest : { ...latest, status: "UNKNOWN" };
}
