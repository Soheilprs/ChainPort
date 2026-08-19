import type { AnalysisRepository, IngestRepository } from "@chainport/db";
import { UniqueConstraintError } from "@chainport/db";
import { SCANNER_VERSION } from "@chainport/scanner";
import {
  ANALYSIS_ERROR_MESSAGES,
  buildAnalysisIdempotencyKey,
  type RepositoryAnalysis,
} from "@chainport/shared";

import { ApiRequestError } from "./errors.js";
import type { JobQueue } from "./queue.js";

export class AnalysisService {
  public constructor(
    private readonly ingest: IngestRepository,
    private readonly analyses: AnalysisRepository,
    private readonly queue: JobQueue,
  ) {}

  public async createForProject(
    projectId: string,
  ): Promise<{ analysis: RepositoryAnalysis; created: boolean }> {
    const project = await this.ingest.getProjectById(projectId);
    if (project === undefined) {
      throw new ApiRequestError(404, "PROJECT_NOT_FOUND", "Project not found");
    }
    const repository = await this.ingest.getRepositoryById(project.repositoryId);
    const jobs = await this.ingest.listJobsForProject(projectId);
    const completed = jobs.find((job) => job.status === "COMPLETED" && job.repoSha !== null);
    const sha = completed?.repoSha ?? repository?.resolvedCommitSha ?? null;
    if (repository === undefined || sha === null || repository.cloneStatus !== "READY") {
      throw new ApiRequestError(
        409,
        "INGEST_NOT_COMPLETE",
        ANALYSIS_ERROR_MESSAGES.INGEST_NOT_COMPLETE,
      );
    }
    const idempotencyKey = buildAnalysisIdempotencyKey({
      repositoryId: repository.id,
      commitSha: sha,
      scannerVersion: SCANNER_VERSION,
    });
    const existing = await this.analyses.findByIdempotencyKey(idempotencyKey);
    if (existing !== undefined) {
      if (existing.status === "QUEUED" || existing.status === "FAILED") {
        await this.queue.enqueueAnalysis(existing.id);
      }
      return { analysis: existing, created: false };
    }
    try {
      const analysis = await this.analyses.create({
        projectId: project.id,
        repositoryId: repository.id,
        commitSha: sha.toLowerCase(),
        scannerVersion: SCANNER_VERSION,
        idempotencyKey,
      });
      await this.queue.enqueueAnalysis(analysis.id);
      return { analysis, created: true };
    } catch (error) {
      if (!(error instanceof UniqueConstraintError)) {
        throw error;
      }
      const raced = await this.analyses.findByIdempotencyKey(idempotencyKey);
      if (raced === undefined) {
        throw error;
      }
      return { analysis: raced, created: false };
    }
  }

  public async listForProject(projectId: string) {
    const project = await this.ingest.getProjectById(projectId);
    if (project === undefined) {
      throw new ApiRequestError(404, "PROJECT_NOT_FOUND", "Project not found");
    }
    return this.analyses.listForProject(projectId);
  }

  public async get(id: string) {
    const details = await this.analyses.getDetails(id);
    if (details === null) {
      throw new ApiRequestError(404, "ANALYSIS_NOT_FOUND", "Analysis not found");
    }
    return details;
  }
}
