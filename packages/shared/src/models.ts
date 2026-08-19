import type {
  AnalysisStatus,
  CloneStatus,
  CompatibilityCategory,
  CompatibilityReadiness,
  CompatibilityRunStatus,
  CompatibilityStatus,
  ComponentKind,
  CoverageConfidence,
  DetectionConfidence,
  FileCategory,
  FindingCategory,
  FindingSeverity,
  JobStatus,
  OrganizationKind,
  ProjectStatus,
  RemediationType,
  RepositoryProvider,
  RequirementCategory,
} from "./enums.js";
import type { JsonObject } from "./json.js";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  kind: OrganizationKind;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  organizationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Repository {
  id: string;
  provider: RepositoryProvider;
  owner: string;
  name: string;
  normalizedUrl: string;
  defaultBranch: string | null;
  resolvedCommitSha: string | null;
  cloneStatus: CloneStatus;
  clonedAt: Date | null;
  sizeBytes: number | null;
  ingestErrorCode: string | null;
  ingestErrorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  organizationId: string | null;
  repositoryId: string;
  name: string;
  githubUrl: string;
  githubOwner: string;
  githubRepo: string;
  defaultBranch: string;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface MigrationJob {
  id: string;
  projectId: string;
  repositoryId: string;
  sourceChainKey: string;
  targetChainKey: string;
  repoSha: string | null;
  status: JobStatus;
  attempt: number;
  maxAttempts: number;
  idempotencyKey: string;
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobStatusEvent {
  id: string;
  jobId: string;
  fromStatus: JobStatus | null;
  toStatus: JobStatus;
  reason: string | null;
  createdAt: Date;
}

export interface FindingEvidence {
  readonly [key: string]: unknown;
}

export interface Finding {
  id: string;
  jobId: string;
  code: string;
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  description: string;
  filePath: string | null;
  evidence: JsonObject;
  remediation: string | null;
  createdAt: Date;
}

export interface MigrationPlanStep {
  id: string;
  title: string;
  description: string;
  findingIds: readonly string[];
  deterministic: boolean;
}

export interface MigrationPlan {
  id: string;
  jobId: string;
  summary: string;
  steps: readonly MigrationPlanStep[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SandboxRun {
  id: string;
  jobId: string;
  status: JobStatus;
  imageDigest: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Deployment {
  id: string;
  jobId: string;
  targetChainKey: string;
  transactionHash: string | null;
  contractAddress: string | null;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RepositoryAnalysis {
  id: string;
  projectId: string;
  repositoryId: string;
  commitSha: string;
  scannerVersion: string;
  status: AnalysisStatus;
  idempotencyKey: string;
  fileCount: number;
  analyzedFileCount: number;
  skippedFileCount: number;
  totalAnalyzedBytes: number;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalysisStatusEvent {
  id: string;
  analysisId: string;
  fromStatus: AnalysisStatus | null;
  toStatus: AnalysisStatus;
  reason: string | null;
  createdAt: Date;
}

export interface RepositoryFileRecord {
  id: string;
  analysisId: string;
  path: string;
  extension: string;
  category: FileCategory;
  sizeBytes: number;
  analyzed: boolean;
  skipReason: string | null;
}

export interface RepositoryComponentRecord {
  id: string;
  analysisId: string;
  kind: ComponentKind;
  name: string;
  detail: string | null;
  filePath: string | null;
}

export interface ProjectRequirementRecord {
  id: string;
  analysisId: string;
  category: RequirementCategory;
  key: string;
  requirementType: string;
  detectedValue: string;
  normalizedValue: string;
  confidence: DetectionConfidence;
  detector: string;
  detectorVersion: string;
}

export interface AnalysisEvidenceRecord {
  id: string;
  analysisId: string;
  requirementId: string | null;
  filePath: string;
  startLine: number;
  endLine: number;
  evidenceType: string;
  excerpt: string;
}

export interface CompatibilityRun {
  id: string;
  projectId: string;
  analysisId: string;
  repositoryId: string;
  commitSha: string;
  sourceChainKey: string;
  targetChainKey: string;
  scannerVersion: string;
  rulesetVersion: string;
  registryVersion: string;
  registrySnapshotHash: string;
  score: number;
  coverage: number;
  coverageConfidence: CoverageConfidence;
  readiness: CompatibilityReadiness;
  status: CompatibilityRunStatus;
  passCount: number;
  warningCount: number;
  blockerCount: number;
  unknownCount: number;
  idempotencyKey: string;
  errorCode: string | null;
  errorMessage: string | null;
  evaluatedAt: Date | null;
  createdAt: Date;
  completedAt: Date | null;
  updatedAt: Date;
}

export interface CompatibilityFindingRecord {
  id: string;
  compatibilityRunId: string;
  requirementId: string | null;
  ruleId: string;
  ruleVersion: string;
  category: CompatibilityCategory;
  status: CompatibilityStatus;
  title: string;
  summary: string;
  technicalReason: string;
  remediationType: RemediationType;
  sourceValue: string | null;
  targetValue: string | null;
  confidence: CoverageConfidence;
  registryEvidence: JsonObject;
  createdAt: Date;
}

export interface CompatibilityCategoryResultRecord {
  id: string;
  compatibilityRunId: string;
  category: CompatibilityCategory;
  applicable: boolean;
  weight: number;
  score: number | null;
  passCount: number;
  warningCount: number;
  blockerCount: number;
  unknownCount: number;
}

export interface FindingSummary {
  pass: number;
  warning: number;
  blocker: number;
}

export interface CompatibilityFindingSummary {
  pass: number;
  warning: number;
  blocker: number;
  unknown: number;
}

export function summarizeFindings(findings: readonly Pick<Finding, "severity">[]): FindingSummary {
  const summary: FindingSummary = { pass: 0, warning: 0, blocker: 0 };
  for (const finding of findings) {
    if (finding.severity === "PASS") {
      summary.pass += 1;
    } else if (finding.severity === "WARNING") {
      summary.warning += 1;
    } else {
      summary.blocker += 1;
    }
  }
  return summary;
}

export function hasBlockers(findings: readonly Pick<Finding, "severity">[]): boolean {
  return findings.some((finding) => finding.severity === "BLOCKER");
}

export function summarizeCompatibilityFindings(
  findings: readonly Pick<CompatibilityFindingRecord, "status">[],
): CompatibilityFindingSummary {
  const summary: CompatibilityFindingSummary = { pass: 0, warning: 0, blocker: 0, unknown: 0 };
  for (const finding of findings) {
    if (finding.status === "PASS") {
      summary.pass += 1;
    } else if (finding.status === "WARNING") {
      summary.warning += 1;
    } else if (finding.status === "BLOCKER") {
      summary.blocker += 1;
    } else {
      summary.unknown += 1;
    }
  }
  return summary;
}
