export const PRODUCT_NAME = "ChainPort";
export const PRODUCT_TAGLINE = "EVM application portability and ecosystem intelligence";
export const PRODUCT_QUESTION =
  "What prevents this existing Web3 application from working correctly on this target blockchain, and how can we safely migrate it?";
export const PRODUCT_PRINCIPLE = "Compatibility evidence before migration.";
export const CURRENT_PHASE = 11;
export const CURRENT_PHASE_NAME = "Pilot hardening";

export const PRODUCT_IS_NOT = [
  "an RPC provider",
  "an explorer",
  "an indexer",
  "a generic AI coding assistant",
  "a generic GitHub scanner",
  "a generic CI/CD tool",
] as const;

export const SERVICE_NAMES = ["api", "worker", "web"] as const;
export type ServiceName = (typeof SERVICE_NAMES)[number];
