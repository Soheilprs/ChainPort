import type { AnalysisRepository, IngestRepository } from "@chainport/db";
import { materializeRevision, type CloneSource, type WorkspaceManager } from "@chainport/ingest";
import { analyzeRepository, SCANNER_VERSION } from "@chainport/scanner";
import {
  isRetryableAnalysisError,
  parseGitHubRepositoryUrl,
  type AnalysisStatus,
  type ServiceConfig,
} from "@chainport/shared";
import { UnrecoverableError } from "bullmq";
import type { Logger } from "pino";

export interface AnalysisProcessorDependencies {
  ingest: IngestRepository;
  analyses: AnalysisRepository;
  workspaces: WorkspaceManager;
  config: Pick<
    ServiceConfig,
    | "CLONE_TIMEOUT_MS"
    | "CLONE_MAX_BYTES"
    | "ANALYSIS_MAX_FILES"
    | "ANALYSIS_MAX_FILE_BYTES"
    | "ANALYSIS_MAX_TOTAL_BYTES"
    | "ANALYSIS_MAX_DEPTH"
  >;
  logger: Logger;
  materialize?: typeof materializeRevision;
  analyze?: typeof analyzeRepository;
  cloneSourceFor?: (normalizedUrl: string) => CloneSource;
}

async function step(
  analyses: AnalysisRepository,
  analysisId: string,
  fromStatus: AnalysisStatus,
  toStatus: AnalysisStatus,
  reason: string,
): Promise<void> {
  await analyses.transition({ analysisId, fromStatus, toStatus, reason });
}

export async function processAnalysisJob(
  analysisId: string,
  deps: AnalysisProcessorDependencies,
): Promise<void> {
  const record = await deps.analyses.getById(analysisId);
  if (record === undefined) {
    throw new UnrecoverableError(`analysis ${analysisId} was not found`);
  }
  if (record.status === "COMPLETED") {
    return;
  }
  const repository = await deps.ingest.getRepositoryById(record.repositoryId);
  if (repository === undefined || repository.resolvedCommitSha === null) {
    throw new UnrecoverableError("repository SHA is missing");
  }
  if (record.commitSha !== repository.resolvedCommitSha.toLowerCase()) {
    await deps.analyses.transition({
      analysisId,
      fromStatus: record.status === "QUEUED" ? "QUEUED" : record.status,
      toStatus: "FAILED",
      reason: "sha mismatch",
      errorCode: "SHA_MISMATCH",
      errorMessage: "Stored analysis SHA does not match repository SHA",
    });
    throw new UnrecoverableError("SHA mismatch");
  }

  const log = deps.logger.child({
    analysisId,
    repositoryId: repository.id,
    commitSha: record.commitSha,
    scannerVersion: SCANNER_VERSION,
  });
  log.info("analysis_started");

  if (record.status === "QUEUED" || record.status === "FAILED") {
    if (record.status === "FAILED") {
      await step(deps.analyses, analysisId, "FAILED", "QUEUED", "retry scheduled");
    }
    await step(deps.analyses, analysisId, "QUEUED", "MATERIALIZING", "materialize started");
  }

  const workspace = await deps.workspaces.allocate();
  try {
    const source = deps.cloneSourceFor?.(repository.normalizedUrl) ?? {
      kind: "github" as const,
      ref: parseGitHubRepositoryUrl(repository.normalizedUrl),
    };
    const materialize = deps.materialize ?? materializeRevision;
    const materialized = await materialize({
      source,
      workspace,
      commitSha: record.commitSha,
      limits: { timeoutMs: deps.config.CLONE_TIMEOUT_MS, maxBytes: deps.config.CLONE_MAX_BYTES },
    });
    if (materialized.commitSha !== record.commitSha) {
      throw new Error("SHA_MISMATCH");
    }
    await step(deps.analyses, analysisId, "MATERIALIZING", "INVENTORYING", "inventory started");
    log.info("inventory_completed");
    await step(deps.analyses, analysisId, "INVENTORYING", "ANALYZING", "detectors started");
    const analyze = deps.analyze ?? analyzeRepository;
    const output = await analyze(materialized.repoPath, {
      maxFiles: deps.config.ANALYSIS_MAX_FILES,
      maxFileBytes: deps.config.ANALYSIS_MAX_FILE_BYTES,
      maxTotalBytes: deps.config.ANALYSIS_MAX_TOTAL_BYTES,
      maxDepth: deps.config.ANALYSIS_MAX_DEPTH,
    });
    await deps.analyses.persistResult(analysisId, output);
    log.info({ detectorRuns: output.detectorRuns.length }, "analysis_persisted");
    await step(deps.analyses, analysisId, "ANALYZING", "COMPLETED", "analysis completed");
    log.info("analysis_completed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "ANALYSIS_FAILED";
    const code = message === "SHA_MISMATCH" ? "SHA_MISMATCH" : "ANALYSIS_FAILED";
    const latest = await deps.analyses.getById(analysisId);
    const fromStatus = latest?.status ?? "ANALYZING";
    if (fromStatus !== "FAILED" && fromStatus !== "COMPLETED") {
      await deps.analyses.transition({
        analysisId,
        fromStatus,
        toStatus: "FAILED",
        reason: "analysis failed",
        errorCode: code,
        errorMessage: message,
      });
    }
    log.warn({ code }, "analysis_failed");
    if (!isRetryableAnalysisError(code)) {
      throw new UnrecoverableError(message);
    }
    throw error;
  } finally {
    await deps.workspaces.cleanup(workspace);
    log.info("workspace_cleaned");
  }
}
