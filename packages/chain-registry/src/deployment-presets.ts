import type { ChainDeploymentMetadata } from "./types.js";

export const ETHERSCAN_V2_API_URL = "https://api.etherscan.io/v2/api";
export const SUPERCHAIN_FAUCET_URL = "https://console.optimism.io/faucet";

const testnetPolicy = {
  confirmationCount: 4,
  verificationProvider: "etherscan-v2",
  verificationApiUrl: ETHERSCAN_V2_API_URL,
  maxFundingWei: "50000000000000000",
  maxGasBudget: 15_000_000,
  maxTransactionCount: 12,
  maxTransactionValueWei: "0",
} as const;

export const sepoliaDeployment: ChainDeploymentMetadata = {
  enabled: true,
  environment: "TESTNET",
  ...testnetPolicy,
  confirmationCount: 12,
};

export const opStackTestnetDeployment: ChainDeploymentMetadata = {
  enabled: true,
  environment: "TESTNET",
  ...testnetPolicy,
  faucetUrl: SUPERCHAIN_FAUCET_URL,
};

export const arbitrumSepoliaDeployment: ChainDeploymentMetadata = {
  enabled: true,
  environment: "TESTNET",
  ...testnetPolicy,
};

export const anvilDeployment: ChainDeploymentMetadata = {
  enabled: true,
  environment: "DEVNET",
  confirmationCount: 1,
  verificationProvider: "none",
  maxFundingWei: "1000000000000000000",
  maxGasBudget: 30_000_000,
  maxTransactionCount: 20,
  maxTransactionValueWei: "0",
};
