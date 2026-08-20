import { readFile } from "node:fs/promises";
import path from "node:path";

import { keccak256, type Hex } from "viem";

export interface BroadcastTransaction {
  hash: string;
  nonce: number | null;
  from: string | null;
  to: string | null;
  value: string;
  gasLimit: string | null;
  contractAddress: string | null;
  contractName: string | null;
  transactionType: string | null;
}

export async function loadForgeBroadcast(
  repoRoot: string,
  chainId: number,
): Promise<BroadcastTransaction[]> {
  const broadcastDir = path.join(repoRoot, "broadcast");
  const latest = await findRunLatest(broadcastDir, chainId);
  if (latest === undefined) {
    return [];
  }
  const raw = await readFile(latest, "utf8");
  const parsed = JSON.parse(raw) as {
    transactions?: Array<{
      hash?: string;
      transactionType?: string;
      contractName?: string;
      contractAddress?: string;
      transaction?: {
        from?: string;
        to?: string;
        nonce?: string | number;
        gas?: string;
        value?: string;
      };
    }>;
    receipts?: Array<{
      transactionHash?: string;
      contractAddress?: string;
      status?: string;
      blockNumber?: string;
    }>;
  };
  const receipts = new Map(
    (parsed.receipts ?? []).map((receipt) => [
      (receipt.transactionHash ?? "").toLowerCase(),
      receipt,
    ]),
  );
  return (parsed.transactions ?? []).flatMap((tx, index) => {
    const hash = tx.hash;
    if (typeof hash !== "string" || hash.length < 10) {
      return [];
    }
    const receipt = receipts.get(hash.toLowerCase());
    const nonce = tx.transaction?.nonce;
    return [
      {
        hash,
        nonce: nonce === undefined ? index : Number(nonce),
        from: tx.transaction?.from ?? null,
        to: tx.transaction?.to ?? null,
        value: tx.transaction?.value ?? "0",
        gasLimit: tx.transaction?.gas ?? null,
        contractAddress: receipt?.contractAddress ?? tx.contractAddress ?? null,
        contractName: tx.contractName ?? null,
        transactionType: tx.transactionType ?? null,
      },
    ];
  });
}

async function findRunLatest(broadcastDir: string, chainId: number): Promise<string | undefined> {
  const { readdir, stat } = await import("node:fs/promises");
  let entries: string[] = [];
  try {
    entries = await readdir(broadcastDir);
  } catch {
    return undefined;
  }
  for (const script of entries) {
    const candidate = path.join(broadcastDir, script, String(chainId), "run-latest.json");
    try {
      await stat(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  return undefined;
}

export function hashesFromProxyJournal(lines: string[]): string[] {
  const hashes: string[] = [];
  for (const line of lines) {
    if (line.trim() === "") {
      continue;
    }
    try {
      const parsed = JSON.parse(line) as { method?: string; rawTx?: string };
      if (parsed.method === "eth_sendRawTransaction" && typeof parsed.rawTx === "string") {
        const hex = (parsed.rawTx.startsWith("0x") ? parsed.rawTx : `0x${parsed.rawTx}`) as Hex;
        hashes.push(keccak256(hex));
      }
    } catch {
      // ignore
    }
  }
  return hashes;
}
