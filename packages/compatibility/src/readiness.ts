import type { CompatibilityReadiness } from "@chainport/shared";

export function determineReadiness(input: {
  blockerCount: number;
  warningCount: number;
  unknownCount: number;
  coverage: number;
}): CompatibilityReadiness {
  if (input.blockerCount > 0) {
    return "BLOCKED";
  }
  if (input.unknownCount > 0 && input.coverage < 50) {
    return "INSUFFICIENT_DATA";
  }
  if (input.warningCount > 0) {
    return "REVIEW_REQUIRED";
  }
  if (input.unknownCount > 0) {
    return "INSUFFICIENT_DATA";
  }
  return "READY";
}
