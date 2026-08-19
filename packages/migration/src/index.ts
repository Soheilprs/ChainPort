import { CURRENT_PHASE, NotImplementedError, type ImplementationStatus } from "@chainport/shared";

export const MIGRATION_IMPLEMENTATION_STATUS =
  "not_implemented" as const satisfies ImplementationStatus;

export interface GeneratedPatch {
  path: string;
  description: string;
  deterministic: true;
}

export function assertMigrationAvailable(): never {
  throw new NotImplementedError("migration planning and patch generation", CURRENT_PHASE);
}
