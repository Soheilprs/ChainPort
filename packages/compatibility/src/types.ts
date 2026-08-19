import type { TargetCapabilitySnapshot } from "@chainport/chain-registry";
import type {
  CompatibilityCategory,
  CompatibilityReadiness,
  CompatibilityStatus,
  CoverageConfidence,
  DetectionConfidence,
  JsonObject,
  RemediationType,
  RequirementCategory,
} from "@chainport/shared";

export interface CompatibilityRequirement {
  id: string;
  category: RequirementCategory;
  key: string;
  requirementType: string;
  detectedValue: string;
  normalizedValue: string;
  confidence: DetectionConfidence;
  detector: string;
  detectorVersion: string;
  evidenceFilePaths: readonly string[];
}

export interface CompatibilityContext {
  sourceChainKey: string;
  sourceChainId: number;
  sourceChainName: string;
  targetChainKey: string;
  targetChainId: number;
  targetChainName: string;
  snapshot: TargetCapabilitySnapshot;
  hasSolidityContracts: boolean;
}

export interface CompatibilityEvaluation {
  status: CompatibilityStatus;
  category: CompatibilityCategory;
  ruleId: string;
  ruleVersion: string;
  requirementId: string | null;
  title: string;
  summary: string;
  technicalReason: string;
  sourceValue: string | null;
  targetValue: string | null;
  confidence: CoverageConfidence;
  remediationType: RemediationType;
  registryEvidence: JsonObject;
}

export interface CompatibilityRule {
  id: string;
  version: string;
  supports(requirement: CompatibilityRequirement): boolean;
  evaluate(
    requirement: CompatibilityRequirement,
    context: CompatibilityContext,
  ): CompatibilityEvaluation | null;
}

export interface CategoryScore {
  category: CompatibilityCategory;
  applicable: boolean;
  weight: number;
  score: number | null;
  passCount: number;
  warningCount: number;
  blockerCount: number;
  unknownCount: number;
}

export interface CompatibilityReport {
  rulesetVersion: string;
  registryVersion: string;
  registrySnapshotHash: string;
  sourceChainKey: string;
  targetChainKey: string;
  score: number;
  coverage: number;
  coverageConfidence: CoverageConfidence;
  readiness: CompatibilityReadiness;
  findings: CompatibilityEvaluation[];
  categories: CategoryScore[];
  counts: {
    pass: number;
    warning: number;
    blocker: number;
    unknown: number;
  };
}
