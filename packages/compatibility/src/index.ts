import {
  CURRENT_PHASE,
  NotImplementedError,
  type FindingSeverity,
  type ImplementationStatus,
} from "@chainport/shared";

export const COMPATIBILITY_IMPLEMENTATION_STATUS =
  "not_implemented" as const satisfies ImplementationStatus;

export interface ApplicationRequirement {
  code: string;
  title: string;
  description: string;
}

export interface CompatibilityFindingDraft {
  code: string;
  severity: FindingSeverity;
  title: string;
  description: string;
}

export function assertCompatibilityAvailable(): never {
  throw new NotImplementedError("compatibility comparison", CURRENT_PHASE);
}
