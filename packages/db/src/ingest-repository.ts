import {
  assertJobTransition,
  createId,
  type CloneStatus,
  type IngestErrorCode,
  type JobStatus,
  type MigrationJob,
  type Project,
  type Repository,
} from "@chainport/shared";

import type { DatabaseClient } from "./client.js";
import { rethrowPersistenceError } from "./client.js";
import { mapJobStatusEvent, mapMigrationJob, mapProject, mapRepository } from "./mappers.js";

export interface UpsertRepositoryInput {
  owner: string;
  name: string;
  normalizedUrl: string;
}

export interface CreateProjectInput {
  repositoryId: string;
  name: string;
  githubUrl: string;
  githubOwner: string;
  githubRepo: string;
  defaultBranch: string;
}

export interface CreateJobInput {
  projectId: string;
  repositoryId: string;
  sourceChainKey: string;
  targetChainKey: string;
  idempotencyKey: string;
}

export interface IngestBundle {
  project: Project;
  repository: Repository;
  job: MigrationJob;
}

export class IngestRepository {
  public constructor(private readonly client: DatabaseClient) {}

  public async upsertRepository(input: UpsertRepositoryInput): Promise<Repository> {
    try {
      const row = await this.client.repository.upsert({
        where: {
          provider_owner_name: {
            provider: "GITHUB",
            owner: input.owner,
            name: input.name,
          },
        },
        create: {
          id: createId(),
          provider: "GITHUB",
          owner: input.owner,
          name: input.name,
          normalizedUrl: input.normalizedUrl,
        },
        update: {
          normalizedUrl: input.normalizedUrl,
        },
      });
      return mapRepository(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async upsertProject(input: CreateProjectInput): Promise<Project> {
    try {
      const existing = await this.client.project.findUnique({
        where: {
          githubOwner_githubRepo: {
            githubOwner: input.githubOwner,
            githubRepo: input.githubRepo,
          },
        },
      });
      if (existing !== null) {
        return mapProject(existing);
      }
      const row = await this.client.project.create({
        data: {
          id: createId(),
          repositoryId: input.repositoryId,
          name: input.name,
          githubUrl: input.githubUrl,
          githubOwner: input.githubOwner,
          githubRepo: input.githubRepo,
          defaultBranch: input.defaultBranch,
        },
      });
      return mapProject(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async findJobByIdempotencyKey(idempotencyKey: string): Promise<MigrationJob | undefined> {
    const row = await this.client.migrationJob.findUnique({ where: { idempotencyKey } });
    return row === null ? undefined : mapMigrationJob(row);
  }

  public async createJob(input: CreateJobInput): Promise<MigrationJob> {
    try {
      const job = await this.client.$transaction(async (tx) => {
        const created = await tx.migrationJob.create({
          data: {
            id: createId(),
            projectId: input.projectId,
            repositoryId: input.repositoryId,
            sourceChainKey: input.sourceChainKey,
            targetChainKey: input.targetChainKey,
            idempotencyKey: input.idempotencyKey,
            status: "QUEUED",
          },
        });
        await tx.jobStatusEvent.create({
          data: {
            id: createId(),
            jobId: created.id,
            fromStatus: null,
            toStatus: "QUEUED",
            reason: "job accepted",
          },
        });
        return created;
      });
      return mapMigrationJob(job);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async getProjectById(id: string): Promise<Project | undefined> {
    const row = await this.client.project.findUnique({ where: { id } });
    return row === null ? undefined : mapProject(row);
  }

  public async getRepositoryById(id: string): Promise<Repository | undefined> {
    const row = await this.client.repository.findUnique({ where: { id } });
    return row === null ? undefined : mapRepository(row);
  }

  public async getJobById(id: string): Promise<MigrationJob | undefined> {
    const row = await this.client.migrationJob.findUnique({ where: { id } });
    return row === null ? undefined : mapMigrationJob(row);
  }

  public async listProjects(limit = 50): Promise<Project[]> {
    const rows = await this.client.project.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(mapProject);
  }

  public async listJobsForProject(projectId: string): Promise<MigrationJob[]> {
    const rows = await this.client.migrationJob.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapMigrationJob);
  }

  public async listStatusEvents(jobId: string) {
    const rows = await this.client.jobStatusEvent.findMany({
      where: { jobId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(mapJobStatusEvent);
  }

  public async transitionJob(input: {
    jobId: string;
    fromStatus: JobStatus;
    toStatus: JobStatus;
    reason: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    repoSha?: string | null;
    attempt?: number;
    leaseOwner?: string | null;
  }): Promise<MigrationJob> {
    assertJobTransition(input.fromStatus, input.toStatus);
    const now = new Date();
    try {
      const row = await this.client.$transaction(async (tx) => {
        const updated = await tx.migrationJob.update({
          where: { id: input.jobId },
          data: {
            status: input.toStatus,
            ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
            ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
            ...(input.repoSha !== undefined ? { repoSha: input.repoSha } : {}),
            ...(input.attempt !== undefined ? { attempt: input.attempt } : {}),
            ...(input.leaseOwner !== undefined ? { leaseOwner: input.leaseOwner } : {}),
            ...(input.toStatus === "INGESTING" ? { startedAt: now } : {}),
            ...(input.toStatus === "COMPLETED" || input.toStatus === "FAILED"
              ? { finishedAt: now }
              : {}),
            ...(input.toStatus === "QUEUED" ? { finishedAt: null } : {}),
          },
        });
        await tx.jobStatusEvent.create({
          data: {
            id: createId(),
            jobId: input.jobId,
            fromStatus: input.fromStatus,
            toStatus: input.toStatus,
            reason: input.reason,
          },
        });
        return updated;
      });
      return mapMigrationJob(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async markRepositoryCloning(repositoryId: string): Promise<Repository> {
    const row = await this.client.repository.update({
      where: { id: repositoryId },
      data: {
        cloneStatus: "CLONING",
        ingestErrorCode: null,
        ingestErrorMessage: null,
      },
    });
    return mapRepository(row);
  }

  public async markRepositoryReady(input: {
    repositoryId: string;
    defaultBranch: string | null;
    resolvedCommitSha: string;
    sizeBytes: number;
  }): Promise<Repository> {
    const row = await this.client.repository.update({
      where: { id: input.repositoryId },
      data: {
        cloneStatus: "READY" satisfies CloneStatus,
        defaultBranch: input.defaultBranch,
        resolvedCommitSha: input.resolvedCommitSha,
        sizeBytes: BigInt(input.sizeBytes),
        clonedAt: new Date(),
        ingestErrorCode: null,
        ingestErrorMessage: null,
      },
    });
    return mapRepository(row);
  }

  public async markRepositoryFailed(
    repositoryId: string,
    code: IngestErrorCode,
    message: string,
  ): Promise<Repository> {
    const row = await this.client.repository.update({
      where: { id: repositoryId },
      data: {
        cloneStatus: "FAILED",
        ingestErrorCode: code,
        ingestErrorMessage: message,
      },
    });
    return mapRepository(row);
  }

  public async getBundleByJobId(jobId: string): Promise<IngestBundle | undefined> {
    const job = await this.getJobById(jobId);
    if (job === undefined) {
      return undefined;
    }
    const project = await this.getProjectById(job.projectId);
    const repository = await this.getRepositoryById(job.repositoryId);
    if (project === undefined || repository === undefined) {
      return undefined;
    }
    return { job, project, repository };
  }
}
