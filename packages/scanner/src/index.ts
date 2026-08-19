import { CURRENT_PHASE, NotImplementedError, type ImplementationStatus } from "@chainport/shared";

export const SCANNER_IMPLEMENTATION_STATUS =
  "not_implemented" as const satisfies ImplementationStatus;

export type DetectedFramework = "foundry" | "hardhat" | "forge-standard" | "unknown";

export interface RepositoryManifest {
  rootFiles: readonly string[];
  solidityFiles: readonly string[];
  packageJsonPresent: boolean;
  foundryTomlPresent: boolean;
  hardhatConfigPresent: boolean;
}

export interface ScannerInput {
  repositoryRoot: string;
}

export interface ScannerResult {
  framework: DetectedFramework;
  manifest: RepositoryManifest;
  hardcodedChainIds: readonly number[];
  hardcodedAddresses: readonly string[];
}

export function assertScannerAvailable(): never {
  throw new NotImplementedError("repository scanner", CURRENT_PHASE);
}
