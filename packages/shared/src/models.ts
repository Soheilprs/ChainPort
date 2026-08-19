import type {
  FindingCategory,
  FindingSeverity,
  JobStatus,
  OrganizationKind,
  ProjectStatus,
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

export interface Project {
  id: string;
  organizationId: string | null;
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

export interface FindingSummary {
  pass: number;
  warning: number;
  blocker: number;
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
