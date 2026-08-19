import {
  assertCompatibilityTransition,
  createId,
  isJsonObject,
  type CompatibilityCategory,
  type CompatibilityReadiness,
  type CompatibilityStatus,
  type CompatibilityRun,
  type CoverageConfidence,
  type JsonObject,
  type RemediationType,
} from "@chainport/shared";

export interface PersistCompatibilityReport {
  score: number;
  coverage: number;
  coverageConfidence: CoverageConfidence;
  readiness: CompatibilityReadiness;
  findings: Array<{
    requirementId: string | null;
    ruleId: string;
    ruleVersion: string;
    category: CompatibilityCategory;
    status: CompatibilityStatus;
    title: string;
    summary: string;
    technicalReason: string;
    remediationType: RemediationType;
    sourceValue: string | null;
    targetValue: string | null;
    confidence: CoverageConfidence;
    registryEvidence: JsonObject;
  }>;
  categories: Array<{
    category: CompatibilityCategory;
    applicable: boolean;
    weight: number;
    score: number | null;
    passCount: number;
    warningCount: number;
    blockerCount: number;
    unknownCount: number;
  }>;
  counts: {
    pass: number;
    warning: number;
    blocker: number;
    unknown: number;
  };
}

import type { DatabaseClient } from "./client.js";
import { rethrowPersistenceError } from "./client.js";

export class CompatibilityRepository {
  public constructor(private readonly client: DatabaseClient) {}

  public async findByIdempotencyKey(key: string): Promise<CompatibilityRun | undefined> {
    const row = await this.client.compatibilityRun.findUnique({ where: { idempotencyKey: key } });
    return row === null ? undefined : mapRun(row);
  }

  public async findByIdentity(input: {
    analysisId: string;
    targetChainKey: string;
    rulesetVersion: string;
    registrySnapshotHash: string;
  }): Promise<CompatibilityRun | undefined> {
    const row = await this.client.compatibilityRun.findUnique({
      where: {
        analysisId_targetChainKey_rulesetVersion_registrySnapshotHash: input,
      },
    });
    return row === null ? undefined : mapRun(row);
  }

  public async getById(id: string): Promise<CompatibilityRun | undefined> {
    const row = await this.client.compatibilityRun.findUnique({ where: { id } });
    return row === null ? undefined : mapRun(row);
  }

  public async listForProject(projectId: string): Promise<CompatibilityRun[]> {
    const rows = await this.client.compatibilityRun.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapRun);
  }

  public async listForAnalysis(analysisId: string): Promise<CompatibilityRun[]> {
    const rows = await this.client.compatibilityRun.findMany({
      where: { analysisId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapRun);
  }

  public async upsertSnapshot(input: {
    hash: string;
    registryVersion: string;
    targetChainKey: string;
    canonicalJson: string;
  }): Promise<void> {
    try {
      await this.client.compatibilityRegistrySnapshot.upsert({
        where: { hash: input.hash },
        create: {
          id: createId(),
          hash: input.hash,
          registryVersion: input.registryVersion,
          targetChainKey: input.targetChainKey,
          canonicalJson: input.canonicalJson,
        },
        update: {},
      });
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async createQueued(input: {
    projectId: string;
    analysisId: string;
    repositoryId: string;
    commitSha: string;
    sourceChainKey: string;
    targetChainKey: string;
    scannerVersion: string;
    rulesetVersion: string;
    registryVersion: string;
    registrySnapshotHash: string;
    idempotencyKey: string;
  }): Promise<CompatibilityRun> {
    try {
      const row = await this.client.$transaction(async (tx) => {
        const created = await tx.compatibilityRun.create({
          data: {
            id: createId(),
            projectId: input.projectId,
            analysisId: input.analysisId,
            repositoryId: input.repositoryId,
            commitSha: input.commitSha,
            sourceChainKey: input.sourceChainKey,
            targetChainKey: input.targetChainKey,
            scannerVersion: input.scannerVersion,
            rulesetVersion: input.rulesetVersion,
            registryVersion: input.registryVersion,
            registrySnapshotHash: input.registrySnapshotHash,
            score: 0,
            coverage: 0,
            coverageConfidence: "LOW",
            readiness: "INSUFFICIENT_DATA",
            status: "QUEUED",
            idempotencyKey: input.idempotencyKey,
          },
        });
        await tx.compatibilityStatusEvent.create({
          data: {
            id: createId(),
            compatibilityRunId: created.id,
            fromStatus: null,
            toStatus: "QUEUED",
            reason: "compatibility requested",
          },
        });
        return created;
      });
      return mapRun(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async persistCompleted(
    runId: string,
    report: PersistCompatibilityReport,
  ): Promise<CompatibilityRun> {
    const now = new Date();
    try {
      const row = await this.client.$transaction(async (tx) => {
        const current = await tx.compatibilityRun.findUniqueOrThrow({ where: { id: runId } });
        if (current.status === "COMPLETED") {
          return current;
        }
        if (current.status === "QUEUED") {
          assertCompatibilityTransition("QUEUED", "EVALUATING");
          await tx.compatibilityStatusEvent.create({
            data: {
              id: createId(),
              compatibilityRunId: runId,
              fromStatus: "QUEUED",
              toStatus: "EVALUATING",
              reason: "evaluating target chain compatibility",
            },
          });
        } else if (current.status === "FAILED") {
          assertCompatibilityTransition("FAILED", "QUEUED");
          assertCompatibilityTransition("QUEUED", "EVALUATING");
          await tx.compatibilityStatusEvent.create({
            data: {
              id: createId(),
              compatibilityRunId: runId,
              fromStatus: "FAILED",
              toStatus: "QUEUED",
              reason: "retrying failed compatibility run",
            },
          });
          await tx.compatibilityStatusEvent.create({
            data: {
              id: createId(),
              compatibilityRunId: runId,
              fromStatus: "QUEUED",
              toStatus: "EVALUATING",
              reason: "evaluating target chain compatibility",
            },
          });
        }
        assertCompatibilityTransition("EVALUATING", "COMPLETED");
        await tx.compatibilityFinding.deleteMany({ where: { compatibilityRunId: runId } });
        await tx.compatibilityCategoryResult.deleteMany({ where: { compatibilityRunId: runId } });
        if (report.findings.length > 0) {
          await tx.compatibilityFinding.createMany({
            data: report.findings.map((finding) => ({
              id: createId(),
              compatibilityRunId: runId,
              requirementId: finding.requirementId,
              ruleId: finding.ruleId,
              ruleVersion: finding.ruleVersion,
              category: finding.category,
              status: finding.status,
              title: finding.title,
              summary: finding.summary,
              technicalReason: finding.technicalReason,
              remediationType: finding.remediationType,
              sourceValue: finding.sourceValue,
              targetValue: finding.targetValue,
              confidence: finding.confidence,
              registryEvidence: finding.registryEvidence,
            })),
          });
        }
        await tx.compatibilityCategoryResult.createMany({
          data: report.categories.map((category) => ({
            id: createId(),
            compatibilityRunId: runId,
            category: category.category,
            applicable: category.applicable,
            weight: category.weight,
            score: category.score,
            passCount: category.passCount,
            warningCount: category.warningCount,
            blockerCount: category.blockerCount,
            unknownCount: category.unknownCount,
          })),
        });
        const updated = await tx.compatibilityRun.update({
          where: { id: runId },
          data: {
            status: "COMPLETED",
            score: report.score,
            coverage: report.coverage,
            coverageConfidence: report.coverageConfidence,
            readiness: report.readiness,
            passCount: report.counts.pass,
            warningCount: report.counts.warning,
            blockerCount: report.counts.blocker,
            unknownCount: report.counts.unknown,
            errorCode: null,
            errorMessage: null,
            evaluatedAt: now,
            completedAt: now,
          },
        });
        await tx.compatibilityStatusEvent.create({
          data: {
            id: createId(),
            compatibilityRunId: runId,
            fromStatus: "EVALUATING",
            toStatus: "COMPLETED",
            reason: "compatibility evaluation completed",
          },
        });
        return updated;
      });
      return mapRun(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async markFailed(
    runId: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<CompatibilityRun> {
    const now = new Date();
    try {
      const row = await this.client.$transaction(async (tx) => {
        const current = await tx.compatibilityRun.findUniqueOrThrow({ where: { id: runId } });
        const fromStatus = current.status;
        if (fromStatus !== "FAILED") {
          assertCompatibilityTransition(fromStatus, "FAILED");
        }
        const updated = await tx.compatibilityRun.update({
          where: { id: runId },
          data: {
            status: "FAILED",
            errorCode,
            errorMessage,
            completedAt: now,
          },
        });
        if (fromStatus !== "FAILED") {
          await tx.compatibilityStatusEvent.create({
            data: {
              id: createId(),
              compatibilityRunId: runId,
              fromStatus,
              toStatus: "FAILED",
              reason: errorMessage,
            },
          });
        }
        return updated;
      });
      return mapRun(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async getDetails(id: string) {
    const run = await this.client.compatibilityRun.findUnique({
      where: { id },
      include: {
        findings: {
          orderBy: [{ status: "asc" }, { category: "asc" }],
          include: { requirement: { include: { evidence: true } } },
        },
        categories: { orderBy: { category: "asc" } },
        statusEvents: { orderBy: { createdAt: "asc" } },
        registrySnapshot: true,
      },
    });
    return run;
  }
}

function mapRun(row: {
  id: string;
  projectId: string;
  analysisId: string;
  repositoryId: string;
  commitSha: string;
  sourceChainKey: string;
  targetChainKey: string;
  scannerVersion: string;
  rulesetVersion: string;
  registryVersion: string;
  registrySnapshotHash: string;
  score: number;
  coverage: number;
  coverageConfidence: string;
  readiness: CompatibilityRun["readiness"];
  status: CompatibilityRun["status"];
  passCount: number;
  warningCount: number;
  blockerCount: number;
  unknownCount: number;
  idempotencyKey: string;
  errorCode: string | null;
  errorMessage: string | null;
  evaluatedAt: Date | null;
  createdAt: Date;
  completedAt: Date | null;
  updatedAt: Date;
}): CompatibilityRun {
  return {
    ...row,
    coverageConfidence: row.coverageConfidence as CoverageConfidence,
  };
}

export function asJsonObject(value: unknown): JsonObject {
  return isJsonObject(value) ? value : {};
}
