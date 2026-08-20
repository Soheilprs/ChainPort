import { getChainByKey } from "@chainport/chain-registry";
import {
  UniqueConstraintError,
  type IngestRepository,
  type PartnerRepository,
} from "@chainport/db";
import {
  buildIngestIdempotencyKey,
  canRetryJob,
  githubRepositoryName,
  INGEST_ERROR_MESSAGES,
  isRetryableIngestError,
  parseGitHubRepositoryUrl,
  type AcquisitionSource,
  type JobStatus,
  type MigrationJob,
  type NetworkPartner,
  type Project,
  type Repository,
} from "@chainport/shared";
import { z } from "zod";

import { ApiRequestError } from "./errors.js";
import type { IngestJobQueue } from "./queue.js";

const createProjectBodySchema = z.object({
  repositoryUrl: z.string().trim().min(1),
  sourceChainKey: z.string().trim().min(1),
  targetChainKey: z.string().trim().min(1),
});

const partnerProjectBodySchema = z.object({
  repositoryUrl: z.string().trim().min(1),
  sourceChainKey: z.string().trim().min(1),
});

export interface CreateProjectRequest {
  repositoryUrl: string;
  sourceChainKey: string;
  targetChainKey: string;
}

export interface ProjectResponse {
  project: Project;
  repository: Repository;
  job: MigrationJob;
}

export class ProjectsService {
  public constructor(
    private readonly ingest: IngestRepository,
    private readonly queue: IngestJobQueue,
    private readonly partners?: PartnerRepository,
  ) {}

  public parseCreateRequest(body: unknown): CreateProjectRequest {
    const parsed = createProjectBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiRequestError(400, "INVALID_REQUEST", INGEST_ERROR_MESSAGES.INVALID_REQUEST);
    }
    return parsed.data;
  }

  public async create(body: unknown): Promise<{ data: ProjectResponse; created: boolean }> {
    const request = this.parseCreateRequest(body);
    return this.ingestAndEnqueue({
      ...request,
      acquisitionSource: "GENERIC_PORTAL",
      networkPartnerId: null,
    });
  }

  public async createFromPartner(
    partner: NetworkPartner,
    body: unknown,
  ): Promise<{ data: ProjectResponse; created: boolean }> {
    const record = asRecord(body);
    if (
      typeof record.targetChainKey === "string" &&
      record.targetChainKey.trim() !== "" &&
      record.targetChainKey.trim() !== partner.networkKey
    ) {
      throw new ApiRequestError(
        400,
        "PARTNER_TARGET_MISMATCH",
        "Partner portal target network cannot be changed",
      );
    }
    const parsed = partnerProjectBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiRequestError(400, "INVALID_REQUEST", INGEST_ERROR_MESSAGES.INVALID_REQUEST);
    }
    return this.ingestAndEnqueue({
      repositoryUrl: parsed.data.repositoryUrl,
      sourceChainKey: parsed.data.sourceChainKey,
      targetChainKey: partner.networkKey,
      acquisitionSource: "PARTNER_PORTAL",
      networkPartnerId: partner.id,
    });
  }

  public async resolvePartner(project: Project): Promise<NetworkPartner | null> {
    if (project.networkPartnerId === null || this.partners === undefined) {
      return null;
    }
    return (await this.partners.getById(project.networkPartnerId)) ?? null;
  }

  private async ingestAndEnqueue(request: {
    repositoryUrl: string;
    sourceChainKey: string;
    targetChainKey: string;
    acquisitionSource: AcquisitionSource;
    networkPartnerId: string | null;
  }): Promise<{ data: ProjectResponse; created: boolean }> {
    let ref;
    try {
      ref = parseGitHubRepositoryUrl(request.repositoryUrl);
    } catch {
      throw new ApiRequestError(
        400,
        "INVALID_REPOSITORY_URL",
        INGEST_ERROR_MESSAGES.INVALID_REPOSITORY_URL,
      );
    }

    this.assertChains(request.sourceChainKey, request.targetChainKey);

    const repository = await this.ingest.upsertRepository({
      owner: ref.owner,
      name: ref.repo,
      normalizedUrl: ref.url,
    });
    const project = await this.ingest.upsertProject({
      repositoryId: repository.id,
      name: githubRepositoryName(ref),
      githubUrl: ref.url,
      githubOwner: ref.owner,
      githubRepo: ref.repo,
      defaultBranch: "main",
      networkPartnerId: request.networkPartnerId,
      acquisitionSource: request.acquisitionSource,
    });

    const idempotencyKey = buildIngestIdempotencyKey({
      owner: ref.owner,
      repo: ref.repo,
      sourceChainKey: request.sourceChainKey,
      targetChainKey: request.targetChainKey,
    });

    let created = false;
    let job = await this.ingest.findJobByIdempotencyKey(idempotencyKey);
    if (job === undefined) {
      try {
        job = await this.ingest.createJob({
          projectId: project.id,
          repositoryId: repository.id,
          sourceChainKey: request.sourceChainKey,
          targetChainKey: request.targetChainKey,
          idempotencyKey,
        });
        created = true;
      } catch (error) {
        if (!(error instanceof UniqueConstraintError)) {
          throw error;
        }
        job = await this.ingest.findJobByIdempotencyKey(idempotencyKey);
        if (job === undefined) {
          throw error;
        }
      }
    }

    await this.enqueueIfNeeded(job);
    const latest = await this.ingest.getJobById(job.id);
    if (latest === undefined) {
      throw new ApiRequestError(500, "INTERNAL_ERROR", "Job could not be loaded");
    }

    return {
      created,
      data: {
        project,
        repository,
        job: latest,
      },
    };
  }

  public async getProject(id: string): Promise<ProjectResponse> {
    const project = await this.ingest.getProjectById(id);
    if (project === undefined) {
      throw new ApiRequestError(404, "PROJECT_NOT_FOUND", "Project not found");
    }
    const repository = await this.ingest.getRepositoryById(project.repositoryId);
    const jobs = await this.ingest.listJobsForProject(project.id);
    const job = jobs[0];
    if (repository === undefined || job === undefined) {
      throw new ApiRequestError(404, "PROJECT_NOT_FOUND", "Project not found");
    }
    return { project, repository, job };
  }

  public async listProjects() {
    return this.ingest.listProjects();
  }

  public async listProjectJobs(projectId: string) {
    const project = await this.ingest.getProjectById(projectId);
    if (project === undefined) {
      throw new ApiRequestError(404, "PROJECT_NOT_FOUND", "Project not found");
    }
    return this.ingest.listJobsForProject(projectId);
  }

  public async getJob(jobId: string) {
    const bundle = await this.ingest.getBundleByJobId(jobId);
    if (bundle === undefined) {
      throw new ApiRequestError(404, "JOB_NOT_FOUND", "Job not found");
    }
    const events = await this.ingest.listStatusEvents(jobId);
    return { ...bundle, events };
  }

  private assertChains(sourceChainKey: string, targetChainKey: string): void {
    const source = getChainByKey(sourceChainKey);
    const target = getChainByKey(targetChainKey);
    if (source === undefined || target === undefined) {
      throw new ApiRequestError(400, "UNKNOWN_CHAIN", INGEST_ERROR_MESSAGES.UNKNOWN_CHAIN);
    }
    if (sourceChainKey === targetChainKey) {
      throw new ApiRequestError(
        400,
        "SOURCE_TARGET_SAME",
        INGEST_ERROR_MESSAGES.SOURCE_TARGET_SAME,
      );
    }
    if (!source.roles.includes("source")) {
      throw new ApiRequestError(400, "UNKNOWN_CHAIN", "Source chain is not a supported source");
    }
    if (!target.roles.includes("target")) {
      throw new ApiRequestError(400, "UNKNOWN_CHAIN", "Target chain is not a supported target");
    }
  }

  private async enqueueIfNeeded(job: MigrationJob): Promise<void> {
    const status: JobStatus = job.status;
    if (status === "QUEUED") {
      await this.queue.enqueueIngest(job.id);
      return;
    }
    if (
      status === "FAILED" &&
      isRetryableIngestError(job.errorCode) &&
      canRetryJob(job.status, job.attempt, job.maxAttempts)
    ) {
      await this.queue.enqueueIngest(job.id);
    }
  }
}

function asRecord(body: unknown): Record<string, unknown> {
  if (body === undefined || body === null) {
    return {};
  }
  if (typeof body !== "object" || Array.isArray(body)) {
    throw new ApiRequestError(400, "INVALID_REQUEST", INGEST_ERROR_MESSAGES.INVALID_REQUEST);
  }
  return body as Record<string, unknown>;
}
