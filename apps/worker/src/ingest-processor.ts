import type { IngestRepository } from "@chainport/db";
import {
  cloneIntoWorkspace,
  HttpGitHubMetadataClient,
  IngestError,
  type CloneResult,
  type CloneSource,
  type GitHubMetadataClient,
  type Workspace,
  type WorkspaceManager,
} from "@chainport/ingest";
import {
  canRetryJob,
  isRetryableIngestError,
  parseGitHubRepositoryUrl,
  type IngestErrorCode,
  type JobStatus,
  type ServiceConfig,
} from "@chainport/shared";
import { UnrecoverableError } from "bullmq";
import type { Logger } from "pino";

export interface IngestProcessorDependencies {
  ingest: IngestRepository;
  workspaces: WorkspaceManager;
  metadata: GitHubMetadataClient;
  config: Pick<ServiceConfig, "CLONE_TIMEOUT_MS" | "CLONE_MAX_BYTES">;
  logger: Logger;
  workerId: string;
  clone?: (input: {
    source: CloneSource;
    workspace: Workspace;
    limits: { timeoutMs: number; maxBytes: number };
    metadata?: GitHubMetadataClient;
  }) => Promise<CloneResult>;
}

function asIngestError(error: unknown): IngestError {
  if (error instanceof IngestError) {
    return error;
  }
  return new IngestError("CLONE_FAILED");
}

async function ensureIngesting(
  ingest: IngestRepository,
  jobId: string,
  status: JobStatus,
  attempt: number,
  workerId: string,
  logger: Logger,
): Promise<JobStatus> {
  if (status === "QUEUED") {
    await ingest.transitionJob({
      jobId,
      fromStatus: "QUEUED",
      toStatus: "INGESTING",
      reason: "clone started",
      attempt: attempt + 1,
      leaseOwner: workerId,
    });
    return "INGESTING";
  }
  if (status === "FAILED") {
    await ingest.transitionJob({
      jobId,
      fromStatus: "FAILED",
      toStatus: "QUEUED",
      reason: "retry scheduled",
      leaseOwner: workerId,
    });
    logger.info({ jobId }, "retry scheduled");
    await ingest.transitionJob({
      jobId,
      fromStatus: "QUEUED",
      toStatus: "INGESTING",
      reason: "clone started",
      attempt: attempt + 1,
      leaseOwner: workerId,
    });
    return "INGESTING";
  }
  return status;
}

export async function processIngestJob(
  jobId: string,
  deps: IngestProcessorDependencies,
): Promise<void> {
  const bundle = await deps.ingest.getBundleByJobId(jobId);
  if (bundle === undefined) {
    throw new UnrecoverableError(`job ${jobId} was not found`);
  }

  const { job, project, repository } = bundle;
  const log = deps.logger.child({
    jobId: job.id,
    projectId: project.id,
    repositoryId: repository.id,
  });

  if (job.status === "COMPLETED") {
    log.info("ingest already completed");
    return;
  }

  const status = await ensureIngesting(
    deps.ingest,
    job.id,
    job.status,
    job.attempt,
    deps.workerId,
    log,
  );
  if (status !== "INGESTING") {
    log.info({ status }, "job is not executable for ingest");
    return;
  }

  log.info("clone started");
  await deps.ingest.markRepositoryCloning(repository.id);

  const workspace = await deps.workspaces.allocate();
  try {
    const ref = parseGitHubRepositoryUrl(repository.normalizedUrl);
    const clone = deps.clone ?? cloneIntoWorkspace;
    const result = await clone({
      source: { kind: "github", ref },
      workspace,
      limits: {
        timeoutMs: deps.config.CLONE_TIMEOUT_MS,
        maxBytes: deps.config.CLONE_MAX_BYTES,
      },
      metadata: deps.metadata,
    });

    await deps.ingest.markRepositoryReady({
      repositoryId: repository.id,
      defaultBranch: result.defaultBranch,
      resolvedCommitSha: result.commitSha,
      sizeBytes: result.sizeBytes,
    });
    await deps.ingest.transitionJob({
      jobId: job.id,
      fromStatus: "INGESTING",
      toStatus: "COMPLETED",
      reason: "repository ready",
      repoSha: result.commitSha,
      errorCode: null,
      errorMessage: null,
      leaseOwner: null,
    });
    log.info(
      { commitSha: result.commitSha, durationMs: result.durationMs, sizeBytes: result.sizeBytes },
      "clone completed",
    );
  } catch (error) {
    const ingestError = asIngestError(error);
    const code: IngestErrorCode = ingestError.code;
    log.warn({ code, err: ingestError }, "clone failed");
    await deps.ingest.markRepositoryFailed(repository.id, code, ingestError.message);
    const latest = await deps.ingest.getJobById(job.id);
    const attempt = latest?.attempt ?? job.attempt;
    const maxAttempts = latest?.maxAttempts ?? job.maxAttempts;
    await deps.ingest.transitionJob({
      jobId: job.id,
      fromStatus: "INGESTING",
      toStatus: "FAILED",
      reason: "clone failed",
      errorCode: code,
      errorMessage: ingestError.message,
      leaseOwner: null,
    });
    const retryable = isRetryableIngestError(code) && canRetryJob("FAILED", attempt, maxAttempts);
    if (!retryable) {
      throw new UnrecoverableError(ingestError.message);
    }
    throw ingestError;
  } finally {
    try {
      await deps.workspaces.cleanup(workspace);
      log.info("cleanup completed");
    } catch (error) {
      log.error({ err: asIngestError(error) }, "workspace cleanup failed");
    }
  }
}

export function createGitHubMetadataClient(config: ServiceConfig): GitHubMetadataClient {
  return new HttpGitHubMetadataClient(
    config.GITHUB_API_BASE_URL,
    Math.min(config.CLONE_TIMEOUT_MS, 15_000),
  );
}
