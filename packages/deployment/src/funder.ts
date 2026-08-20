import { createWalletClient, http, publicActions, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import type { ChainDefinition } from "@chainport/chain-registry";

import { DeploymentEngineError } from "./errors.js";
import { jsonRpc } from "./rpc.js";

export interface FundResult {
  txHash: string | null;
  amountWei: bigint;
  method: "anvil_setBalance" | "transfer";
}

export async function fundDeployer(input: {
  chain: ChainDefinition;
  rpcUrl: string;
  address: `0x${string}`;
  amountWei: bigint;
  funderPrivateKey?: string;
}): Promise<FundResult> {
  if (input.amountWei <= 0n) {
    throw new DeploymentEngineError(
      "TESTNET_FUNDING_UNAVAILABLE",
      "funding amount must be positive",
    );
  }
  if (input.chain.key === "anvil") {
    await jsonRpc(input.rpcUrl, "anvil_setBalance", [
      input.address,
      `0x${input.amountWei.toString(16)}`,
    ]);
    return { txHash: null, amountWei: input.amountWei, method: "anvil_setBalance" };
  }
  const key = input.funderPrivateKey;
  if (key === undefined || key.trim() === "") {
    throw new DeploymentEngineError("TESTNET_FUNDING_UNAVAILABLE");
  }
  const account = privateKeyToAccount(normalizeKey(key));
  const client = createWalletClient({
    account,
    transport: http(input.rpcUrl),
  }).extend(publicActions);
  const hash = await client.sendTransaction({
    account,
    chain: null,
    to: input.address,
    value: input.amountWei,
  });
  await client.waitForTransactionReceipt({ hash });
  return { txHash: hash, amountWei: input.amountWei, method: "transfer" };
}

function normalizeKey(value: string): Hex {
  return (value.startsWith("0x") ? value : `0x${value}`) as Hex;
}
