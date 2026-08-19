import type {
  CloneStatus,
  JobStatus,
  JobStatusEvent,
  MigrationJob,
  Project,
  ProjectStatus,
  Repository,
  RepositoryProvider,
} from "@chainport/shared";
import type {
  JobStatusEvent as PrismaJobStatusEvent,
  MigrationJob as PrismaMigrationJob,
  Project as PrismaProject,
  Repository as PrismaRepository,
} from "@prisma/client";

function toNumberOrNull(value: bigint | null): number | null {
  if (value === null) {
    return null;
  }
  const asNumber = Number(value);
  return Number.isSafeInteger(asNumber) ? asNumber : null;
}

export function mapRepository(row: PrismaRepository): Repository {
  return {
    id: row.id,
    provider: row.provider as RepositoryProvider,
    owner: row.owner,
    name: row.name,
    normalizedUrl: row.normalizedUrl,
    defaultBranch: row.defaultBranch,
    resolvedCommitSha: row.resolvedCommitSha,
    cloneStatus: row.cloneStatus as CloneStatus,
    clonedAt: row.clonedAt,
    sizeBytes: toNumberOrNull(row.sizeBytes),
    ingestErrorCode: row.ingestErrorCode,
    ingestErrorMessage: row.ingestErrorMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapProject(row: PrismaProject): Project {
  return {
    id: row.id,
    organizationId: row.organizationId,
    repositoryId: row.repositoryId,
    name: row.name,
    githubUrl: row.githubUrl,
    githubOwner: row.githubOwner,
    githubRepo: row.githubRepo,
    defaultBranch: row.defaultBranch,
    status: row.status as ProjectStatus,
    activeRevisionId: row.activeRevisionId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapMigrationJob(row: PrismaMigrationJob): MigrationJob {
  return {
    id: row.id,
    projectId: row.projectId,
    repositoryId: row.repositoryId,
    sourceChainKey: row.sourceChainKey,
    targetChainKey: row.targetChainKey,
    repoSha: row.repoSha,
    status: row.status as JobStatus,
    attempt: row.attempt,
    maxAttempts: row.maxAttempts,
    idempotencyKey: row.idempotencyKey,
    leaseOwner: row.leaseOwner,
    leaseExpiresAt: row.leaseExpiresAt,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapJobStatusEvent(row: PrismaJobStatusEvent): JobStatusEvent {
  return {
    id: row.id,
    jobId: row.jobId,
    fromStatus: row.fromStatus as JobStatus | null,
    toStatus: row.toStatus as JobStatus,
    reason: row.reason,
    createdAt: row.createdAt,
  };
}
