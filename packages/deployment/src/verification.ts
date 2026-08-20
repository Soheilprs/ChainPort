import type { DeploymentSourceVerificationStatus } from "@chainport/shared";
import type { ChainDefinition } from "@chainport/chain-registry";

export interface SourceVerificationResult {
  status: DeploymentSourceVerificationStatus;
  message: string;
}

export async function verifyContractSource(input: {
  chain: ChainDefinition;
  address: string;
  apiKey: string | undefined;
  compilerVersion: string | null;
  source: string | null;
  constructorArgs: string | null;
}): Promise<SourceVerificationResult> {
  const provider = input.chain.deployment?.verificationProvider ?? "none";
  if (provider === "none") {
    return {
      status: "NOT_SUPPORTED",
      message: "no explorer verification provider for this network",
    };
  }
  if (input.apiKey === undefined || input.apiKey.trim() === "") {
    return { status: "NOT_CONFIGURED", message: "explorer API key is not configured" };
  }
  if (input.compilerVersion === null || input.source === null) {
    return {
      status: "NOT_SUPPORTED",
      message: "exact compiler metadata could not be reconstructed from trusted artifacts",
    };
  }
  const apiUrl = input.chain.deployment?.verificationApiUrl;
  if (apiUrl === undefined) {
    return { status: "NOT_CONFIGURED", message: "verification API URL is not in the registry" };
  }
  try {
    const body = new URLSearchParams({
      module: "contract",
      action: "verifysourcecode",
      apikey: input.apiKey,
      chainid: String(input.chain.chainId),
      contractaddress: input.address,
      sourceCode: input.source,
      codeformat: "solidity-single-file",
      contractname: "Counter",
      compilerversion: input.compilerVersion,
      optimizationUsed: "0",
      constructorArguements: input.constructorArgs ?? "",
    });
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    const text = await response.text();
    if (!response.ok) {
      return { status: "FAILED", message: `explorer HTTP ${response.status}` };
    }
    return { status: "VERIFIED", message: text.slice(0, 500) };
  } catch (error) {
    return {
      status: "FAILED",
      message: error instanceof Error ? error.message : "explorer verification failed",
    };
  }
}
