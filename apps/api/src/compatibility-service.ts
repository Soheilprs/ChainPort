import { getChainByKey, snapshotForChainKey } from "@chainport/chain-registry";
import { COMPATIBILITY_RULESET_VERSION, evaluateCompatibility } from "@chainport/compatibility";
import {
  UniqueConstraintError,
  type AnalysisRepository,
  type CompatibilityRepository,
  type IngestRepository,
} from "@chainport/db";
import {
  buildCompatibilityIdempotencyKey,
  COMPATIBILITY_ERROR_MESSAGES,
  type CompatibilityRun,
} from "@chainport/shared";
import { z } from "zod";

import { ApiRequestError } from "./errors.js";

const createBodySchema = z.object({
  analysisId: z.string().uuid().optional(),
  sourceChainKey: z.string().trim().min(1).optional(),
  targetChainKey: z.string().trim().min(1).optional(),
});

export class CompatibilityService {
  public constructor(
    private readonly ingest: IngestRepository,
    private readonly analyses: AnalysisRepository,
    private readonly compatibility: CompatibilityRepository,
  ) {}

  public async createForProject(
    projectId: string,
    body: unknown,
  ): Promise<{ run: CompatibilityRun; created: boolean }> {
    const parsed = createBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new ApiRequestError(
        400,
        "INVALID_REQUEST",
        COMPATIBILITY_ERROR_MESSAGES.INVALID_REQUEST,
      );
    }

    const project = await this.ingest.getProjectById(projectId);
    if (project === undefined) {
      throw new ApiRequestError(
        404,
        "PROJECT_NOT_FOUND",
        COMPATIBILITY_ERROR_MESSAGES.PROJECT_NOT_FOUND,
      );
    }

    const jobs = await this.ingest.listJobsForProject(projectId);
    const latestJob = jobs[0];
    const sourceChainKey = parsed.data.sourceChainKey ?? latestJob?.sourceChainKey;
    const targetChainKey = parsed.data.targetChainKey ?? latestJob?.targetChainKey;
    if (sourceChainKey === undefined || targetChainKey === undefined) {
      throw new ApiRequestError(
        400,
        "INVALID_REQUEST",
        COMPATIBILITY_ERROR_MESSAGES.INVALID_REQUEST,
      );
    }

    const source = getChainByKey(sourceChainKey);
    if (source === undefined) {
      throw new ApiRequestError(
        400,
        "SOURCE_CHAIN_NOT_FOUND",
        COMPATIBILITY_ERROR_MESSAGES.SOURCE_CHAIN_NOT_FOUND,
      );
    }
    const target = getChainByKey(targetChainKey);
    if (target === undefined) {
      throw new ApiRequestError(
        400,
        "TARGET_CHAIN_NOT_FOUND",
        COMPATIBILITY_ERROR_MESSAGES.TARGET_CHAIN_NOT_FOUND,
      );
    }
    if (!target.roles.includes("target")) {
      throw new ApiRequestError(
        400,
        "TARGET_NOT_SUPPORTED",
        COMPATIBILITY_ERROR_MESSAGES.TARGET_NOT_SUPPORTED,
      );
    }

    const analysis = await this.resolveAnalysis(projectId, parsed.data.analysisId);
    if (analysis.status !== "COMPLETED") {
      throw new ApiRequestError(
        409,
        "ANALYSIS_NOT_COMPLETE",
        COMPATIBILITY_ERROR_MESSAGES.ANALYSIS_NOT_COMPLETE,
      );
    }

    const hashed = snapshotForChainKey(targetChainKey);
    const idempotencyKey = buildCompatibilityIdempotencyKey({
      analysisId: analysis.id,
      targetChainKey,
      rulesetVersion: COMPATIBILITY_RULESET_VERSION,
      registrySnapshotHash: hashed.hash,
    });

    const existing = await this.compatibility.findByIdempotencyKey(idempotencyKey);
    if (existing?.status === "COMPLETED") {
      return { run: existing, created: false };
    }

    await this.compatibility.upsertSnapshot({
      hash: hashed.hash,
      registryVersion: hashed.snapshot.registryVersion,
      targetChainKey,
      canonicalJson: hashed.canonicalJson,
    });

    let run = existing;
    if (run === undefined) {
      try {
        run = await this.compatibility.createQueued({
          projectId: project.id,
          analysisId: analysis.id,
          repositoryId: analysis.repositoryId,
          commitSha: analysis.commitSha,
          sourceChainKey,
          targetChainKey,
          scannerVersion: analysis.scannerVersion,
          rulesetVersion: COMPATIBILITY_RULESET_VERSION,
          registryVersion: hashed.snapshot.registryVersion,
          registrySnapshotHash: hashed.hash,
          idempotencyKey,
        });
      } catch (error) {
        if (!(error instanceof UniqueConstraintError)) {
          throw error;
        }
        const raced = await this.compatibility.findByIdempotencyKey(idempotencyKey);
        if (raced?.status === "COMPLETED") {
          return { run: raced, created: false };
        }
        if (raced === undefined) {
          throw error;
        }
        run = raced;
      }
    }

    try {
      const details = await this.analyses.getDetails(analysis.id);
      if (details === null) {
        throw new ApiRequestError(
          404,
          "ANALYSIS_NOT_FOUND",
          COMPATIBILITY_ERROR_MESSAGES.ANALYSIS_NOT_FOUND,
        );
      }
      const report = evaluateCompatibility({
        sourceChainKey,
        sourceChainId: source.chainId,
        sourceChainName: source.name,
        targetChainKey,
        targetChainId: target.chainId,
        targetChainName: target.name,
        snapshot: hashed.snapshot,
        hasSolidityContracts: details.components.some(
          (item) => item.kind === "CONTRACT" || item.name === "solidity",
        ),
        requirements: details.requirements.map((item) => ({
          id: item.id,
          category: item.category,
          key: item.key,
          requirementType: item.requirementType,
          detectedValue: item.detectedValue,
          normalizedValue: item.normalizedValue,
          confidence: item.confidence,
          detector: item.detector,
          detectorVersion: item.detectorVersion,
          evidenceFilePaths: item.evidence.map((entry) => entry.filePath),
        })),
      });
      const completed = await this.compatibility.persistCompleted(run.id, report);
      return { run: completed, created: existing === undefined };
    } catch (error) {
      if (error instanceof ApiRequestError) {
        throw error;
      }
      await this.compatibility.markFailed(
        run.id,
        "EVALUATION_FAILED",
        COMPATIBILITY_ERROR_MESSAGES.EVALUATION_FAILED,
      );
      throw error;
    }
  }

  public async listForProject(projectId: string) {
    const project = await this.ingest.getProjectById(projectId);
    if (project === undefined) {
      throw new ApiRequestError(
        404,
        "PROJECT_NOT_FOUND",
        COMPATIBILITY_ERROR_MESSAGES.PROJECT_NOT_FOUND,
      );
    }
    return this.compatibility.listForProject(projectId);
  }

  public async listForAnalysis(analysisId: string) {
    const analysis = await this.analyses.getById(analysisId);
    if (analysis === undefined) {
      throw new ApiRequestError(
        404,
        "ANALYSIS_NOT_FOUND",
        COMPATIBILITY_ERROR_MESSAGES.ANALYSIS_NOT_FOUND,
      );
    }
    return this.compatibility.listForAnalysis(analysisId);
  }

  public async get(id: string) {
    const details = await this.compatibility.getDetails(id);
    if (details === null) {
      throw new ApiRequestError(404, "COMPATIBILITY_NOT_FOUND", "Compatibility report not found");
    }
    return details;
  }

  private async resolveAnalysis(projectId: string, analysisId: string | undefined) {
    if (analysisId !== undefined) {
      const analysis = await this.analyses.getById(analysisId);
      if (analysis === undefined || analysis.projectId !== projectId) {
        throw new ApiRequestError(
          404,
          "ANALYSIS_NOT_FOUND",
          COMPATIBILITY_ERROR_MESSAGES.ANALYSIS_NOT_FOUND,
        );
      }
      return analysis;
    }
    const analyses = await this.analyses.listForProject(projectId);
    const completed = analyses.find((item) => item.status === "COMPLETED");
    if (completed === undefined) {
      throw new ApiRequestError(
        409,
        "ANALYSIS_NOT_COMPLETE",
        COMPATIBILITY_ERROR_MESSAGES.ANALYSIS_NOT_COMPLETE,
      );
    }
    return completed;
  }
}
