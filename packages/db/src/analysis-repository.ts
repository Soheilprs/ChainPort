import {
  assertAnalysisTransition,
  createId,
  type AnalysisStatus,
  type ComponentKind,
  type DetectionConfidence,
  type FileCategory,
  type RepositoryAnalysis,
  type RequirementCategory,
} from "@chainport/shared";

import type { DatabaseClient } from "./client.js";
import { rethrowPersistenceError } from "./client.js";

export class AnalysisRepository {
  public constructor(private readonly client: DatabaseClient) {}

  public async findByIdempotencyKey(key: string): Promise<RepositoryAnalysis | undefined> {
    const row = await this.client.repositoryAnalysis.findUnique({ where: { idempotencyKey: key } });
    return row === null ? undefined : mapAnalysis(row);
  }

  public async getById(id: string): Promise<RepositoryAnalysis | undefined> {
    const row = await this.client.repositoryAnalysis.findUnique({ where: { id } });
    return row === null ? undefined : mapAnalysis(row);
  }

  public async listForProject(projectId: string): Promise<RepositoryAnalysis[]> {
    const rows = await this.client.repositoryAnalysis.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapAnalysis);
  }

  public async create(input: {
    projectId: string;
    repositoryId: string;
    commitSha: string;
    scannerVersion: string;
    idempotencyKey: string;
  }): Promise<RepositoryAnalysis> {
    try {
      const row = await this.client.$transaction(async (tx) => {
        const created = await tx.repositoryAnalysis.create({
          data: {
            id: createId(),
            projectId: input.projectId,
            repositoryId: input.repositoryId,
            commitSha: input.commitSha,
            scannerVersion: input.scannerVersion,
            idempotencyKey: input.idempotencyKey,
            status: "QUEUED",
          },
        });
        await tx.analysisStatusEvent.create({
          data: {
            id: createId(),
            analysisId: created.id,
            fromStatus: null,
            toStatus: "QUEUED",
            reason: "analysis requested",
          },
        });
        return created;
      });
      return mapAnalysis(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async transition(input: {
    analysisId: string;
    fromStatus: AnalysisStatus;
    toStatus: AnalysisStatus;
    reason: string;
    errorCode?: string | null;
    errorMessage?: string | null;
  }): Promise<RepositoryAnalysis> {
    assertAnalysisTransition(input.fromStatus, input.toStatus);
    const now = new Date();
    try {
      const row = await this.client.$transaction(async (tx) => {
        const updated = await tx.repositoryAnalysis.update({
          where: { id: input.analysisId },
          data: {
            status: input.toStatus,
            ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
            ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
            ...(input.toStatus === "MATERIALIZING" ? { startedAt: now } : {}),
            ...(input.toStatus === "COMPLETED" || input.toStatus === "FAILED"
              ? { completedAt: now }
              : {}),
          },
        });
        await tx.analysisStatusEvent.create({
          data: {
            id: createId(),
            analysisId: input.analysisId,
            fromStatus: input.fromStatus,
            toStatus: input.toStatus,
            reason: input.reason,
          },
        });
        return updated;
      });
      return mapAnalysis(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async persistResult(
    analysisId: string,
    output: {
      fileCount: number;
      analyzedFileCount: number;
      skippedFileCount: number;
      totalAnalyzedBytes: number;
      files: Array<{
        path: string;
        extension: string;
        category: FileCategory;
        sizeBytes: number;
        analyzed: boolean;
        skipReason: string | null;
      }>;
      detectorRuns: Array<{
        detectorId: string;
        detectorVersion: string;
        status: "COMPLETED" | "FAILED";
        durationMs: number;
        errorMessage: string | null;
      }>;
      components: Array<{
        kind: ComponentKind;
        name: string;
        detail: string | null;
        filePath: string | null;
      }>;
      requirements: Array<{
        category: RequirementCategory;
        key: string;
        requirementType: string;
        detectedValue: string;
        normalizedValue: string;
        confidence: DetectionConfidence;
        detector: string;
        detectorVersion: string;
        evidence: Array<{
          filePath: string;
          startLine: number;
          endLine: number;
          evidenceType: string;
          excerpt: string;
        }>;
      }>;
    },
  ): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await tx.repositoryAnalysis.update({
        where: { id: analysisId },
        data: {
          fileCount: output.fileCount,
          analyzedFileCount: output.analyzedFileCount,
          skippedFileCount: output.skippedFileCount,
          totalAnalyzedBytes: output.totalAnalyzedBytes,
        },
      });
      if (output.files.length > 0) {
        await tx.repositoryFile.createMany({
          data: output.files.map((file) => ({
            id: createId(),
            analysisId,
            path: file.path,
            extension: file.extension,
            category: file.category,
            sizeBytes: file.sizeBytes,
            analyzed: file.analyzed,
            skipReason: file.skipReason,
          })),
        });
      }
      for (const run of output.detectorRuns) {
        await tx.analysisDetectorRun.create({
          data: {
            id: createId(),
            analysisId,
            detectorId: run.detectorId,
            detectorVersion: run.detectorVersion,
            status: run.status,
            durationMs: run.durationMs,
            errorMessage: run.errorMessage,
          },
        });
      }
      for (const component of output.components) {
        await tx.repositoryComponent.create({
          data: {
            id: createId(),
            analysisId,
            kind: component.kind,
            name: component.name,
            detail: component.detail,
            filePath: component.filePath,
          },
        });
      }
      for (const requirement of output.requirements) {
        const created = await tx.projectRequirement.create({
          data: {
            id: createId(),
            analysisId,
            category: requirement.category,
            key: requirement.key,
            requirementType: requirement.requirementType,
            detectedValue: requirement.detectedValue,
            normalizedValue: requirement.normalizedValue,
            confidence: requirement.confidence,
            detector: requirement.detector,
            detectorVersion: requirement.detectorVersion,
          },
        });
        for (const evidence of requirement.evidence) {
          await tx.analysisEvidence.create({
            data: {
              id: createId(),
              analysisId,
              requirementId: created.id,
              filePath: evidence.filePath,
              startLine: evidence.startLine,
              endLine: evidence.endLine,
              evidenceType: evidence.evidenceType,
              excerpt: evidence.excerpt,
            },
          });
        }
      }
    });
  }

  public async getDetails(analysisId: string) {
    const analysis = await this.client.repositoryAnalysis.findUnique({
      where: { id: analysisId },
      include: {
        files: true,
        components: true,
        requirements: { include: { evidence: true } },
        statusEvents: { orderBy: { createdAt: "asc" } },
        detectorRuns: true,
      },
    });
    return analysis;
  }
}

function mapAnalysis(row: {
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
}): RepositoryAnalysis {
  return row;
}
