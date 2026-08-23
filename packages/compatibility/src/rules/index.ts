import type { CompatibilityRule } from "../types.js";
import { chainIdCompatibilityRule } from "./chain-id.js";
import { envConfigRule } from "./env-config.js";
import { hardcodedAddressRule } from "./hardcoded-address.js";
import { projectDeploymentRule } from "./project-deployment.js";
import { infrastructureContractRule } from "./infrastructure.js";
import { layerZeroRule } from "./layerzero.js";
import { oracleAvailabilityRule } from "./oracle.js";
import { rpcCapabilityRule } from "./rpc-capability.js";
import { hardcodedRpcRule } from "./rpc-url.js";
import { tokenAvailabilityRule } from "./token.js";
import { uniswapRule } from "./uniswap.js";

export const COMPATIBILITY_RULES: readonly CompatibilityRule[] = [
  chainIdCompatibilityRule,
  envConfigRule,
  hardcodedRpcRule,
  rpcCapabilityRule,
  tokenAvailabilityRule,
  oracleAvailabilityRule,
  infrastructureContractRule,
  uniswapRule,
  layerZeroRule,
  projectDeploymentRule,
  hardcodedAddressRule,
];

export { unmappedRequirementRule } from "./fallback.js";
export { evmSolidityPass } from "./framework.js";
