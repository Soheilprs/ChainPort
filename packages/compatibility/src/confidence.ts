import type {
  CapabilityProvenance,
  CoverageConfidence,
  DetectionConfidence,
} from "@chainport/shared";

export function findingConfidence(
  requirementConfidence: DetectionConfidence,
  provenance: CapabilityProvenance | "NONE" = "NONE",
): CoverageConfidence {
  if (requirementConfidence === "UNKNOWN" || provenance === "UNKNOWN") {
    return "LOW";
  }
  if (requirementConfidence === "LIKELY" || provenance === "DECLARED") {
    return "MEDIUM";
  }
  return "HIGH";
}
