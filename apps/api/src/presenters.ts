import type { JobStatusEvent, MigrationJob, Project, Repository } from "@chainport/shared";

export function presentProject(project: Project) {
  return {
    id: project.id,
    name: project.name,
    repositoryId: project.repositoryId,
    githubOwner: project.githubOwner,
    githubRepo: project.githubRepo,
    githubUrl: project.githubUrl,
    status: project.status,
    activeRevisionId: project.activeRevisionId,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export function presentRepository(repository: Repository) {
  return {
    id: repository.id,
    provider: repository.provider,
    owner: repository.owner,
    name: repository.name,
    normalizedUrl: repository.normalizedUrl,
    defaultBranch: repository.defaultBranch,
    resolvedCommitSha: repository.resolvedCommitSha,
    cloneStatus: repository.cloneStatus,
    clonedAt: repository.clonedAt?.toISOString() ?? null,
    sizeBytes: repository.sizeBytes,
  };
}

export function presentJob(job: MigrationJob) {
  return {
    id: job.id,
    projectId: job.projectId,
    repositoryId: job.repositoryId,
    sourceChainKey: job.sourceChainKey,
    targetChainKey: job.targetChainKey,
    status: job.status,
    repoSha: job.repoSha,
    attempt: job.attempt,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
  };
}

export function presentEvent(event: JobStatusEvent) {
  return {
    id: event.id,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    reason: event.reason,
    createdAt: event.createdAt.toISOString(),
  };
}
