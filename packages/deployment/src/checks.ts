import type { DeploymentCheckStatus } from "@chainport/shared";

import { jsonRpc } from "./rpc.js";

export interface CheckResult {
  name: string;
  status: DeploymentCheckStatus;
  detail: string;
}

export async function runPostDeployChecks(input: {
  rpcUrl: string;
  expectedChainId: number;
  deployer: string;
  contracts: Array<{ address: string; transactionHash: string }>;
  expectedContractCount: number | null;
  transactions: Array<{ hash: string; status: string }>;
}): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];
  const chainIdHex = await jsonRpc<string>(input.rpcUrl, "eth_chainId", []);
  const chainId = Number(BigInt(chainIdHex));
  checks.push({
    name: "CHAIN_ID_MATCH",
    status: chainId === input.expectedChainId ? "PASSED" : "FAILED",
    detail: `rpc=${chainId} expected=${input.expectedChainId}`,
  });

  let success = 0;
  for (const tx of input.transactions) {
    if (tx.status === "CONFIRMED") {
      success += 1;
    }
  }
  checks.push({
    name: "TRANSACTION_SUCCESS",
    status:
      success === input.transactions.length && input.transactions.length > 0 ? "PASSED" : "FAILED",
    detail: `${success}/${input.transactions.length} confirmed`,
  });

  let codePresent = 0;
  for (const contract of input.contracts) {
    const code = await jsonRpc<string>(input.rpcUrl, "eth_getCode", [contract.address, "latest"]);
    if (code !== "0x" && code !== "0x0") {
      codePresent += 1;
    }
  }
  checks.push({
    name: "CONTRACT_CODE_PRESENT",
    status:
      codePresent === input.contracts.length && input.contracts.length > 0 ? "PASSED" : "FAILED",
    detail: `${codePresent}/${input.contracts.length} contracts have bytecode`,
  });

  const nonceHex = await jsonRpc<string>(input.rpcUrl, "eth_getTransactionCount", [
    input.deployer,
    "latest",
  ]);
  const nonce = Number(BigInt(nonceHex));
  checks.push({
    name: "DEPLOYER_NONCE_ADVANCED",
    status: nonce > 0 ? "PASSED" : "FAILED",
    detail: `nonce=${nonce}`,
  });

  if (input.expectedContractCount !== null) {
    checks.push({
      name: "EXPECTED_CONTRACT_COUNT",
      status: input.contracts.length === input.expectedContractCount ? "PASSED" : "FAILED",
      detail: `discovered=${input.contracts.length} expected=${input.expectedContractCount}`,
    });
  }
  return checks;
}
