import type { MigrationRule } from "../types.js";
import { chainIdMigrationRule } from "./chain-id.js";
import { crossChainMigrationRule } from "./cross-chain.js";
import { envConfigMigrationRule } from "./env-config.js";
import { fallbackMigrationRule } from "./fallback.js";
import { unknownAddressMigrationRule } from "./hardcoded-address.js";
import { infrastructureAddressMigrationRule } from "./infrastructure.js";
import { oracleMigrationRule } from "./oracle.js";
import { rpcCapabilityMigrationRule } from "./rpc-capability.js";
import { rpcUrlMigrationRule } from "./rpc-url.js";
import { tokenAddressMigrationRule } from "./token.js";

export const MIGRATION_RULES: readonly MigrationRule[] = [
  chainIdMigrationRule,
  rpcUrlMigrationRule,
  envConfigMigrationRule,
  tokenAddressMigrationRule,
  infrastructureAddressMigrationRule,
  oracleMigrationRule,
  rpcCapabilityMigrationRule,
  crossChainMigrationRule,
  unknownAddressMigrationRule,
  fallbackMigrationRule,
];
