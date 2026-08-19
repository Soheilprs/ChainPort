import {
  assertChangeSetTransition,
  createId,
  type ChangeSetRecord,
  type ChangeSetStatus,
  type ChangeStatus,
  type RevisionCompleteness,
  type RepositoryRevision,
} from "@chainport/shared";

import type { DatabaseClient } from "./client.js";
import { rethrowPersistenceError } from "./client.js";

export interface PersistGeneratedChange {
  migrationActionId: string | null;
  filePath: string;
  patcherId: string | null;
  patcherVersion: string | null;
  changeType: "REPLACE_VALUE" | null;
  status: ChangeStatus;
  skipReason: string | null;
  sourceHash: string | null;
  resultHash: string | null;
  beforeExcerpt: string | null;
  afterExcerpt: string | null;
  unifiedDiff: string | null;
  patchedText: string | null;
  sourceValue: string | null;
  targetValue: string | null;
  reason: string;
}

export class ChangeSetRepository {
  public constructor(private readonly client: DatabaseClient) {}

  public async findByIdempotencyKey(key: string): Promise<ChangeSetRecord | undefined> {
    const row = await this.client.changeSet.findUnique({ where: { idempotencyKey: key } });
    return row === null ? undefined : mapChangeSet(row);
  }

  public async getById(id: string): Promise<ChangeSetRecord | undefined> {
    const row = await this.client.changeSet.findUnique({ where: { id } });
    return row === null ? undefined : mapChangeSet(row);
  }

  public async listForPlan(migrationPlanId: string): Promise<ChangeSetRecord[]> {
    const rows = await this.client.changeSet.findMany({
      where: { migrationPlanId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapChangeSet);
  }

  public async findOriginalRevision(
    repositoryId: string,
    baseCommitSha: string,
  ): Promise<RepositoryRevision | undefined> {
    const row = await this.client.repositoryRevision.findFirst({
      where: { repositoryId, baseCommitSha, type: "ORIGINAL" },
    });
    return row === null ? undefined : mapRevision(row);
  }

  public async createOriginalRevision(input: {
    projectId: string;
    repositoryId: string;
    baseCommitSha: string;
  }): Promise<RepositoryRevision> {
    const existing = await this.findOriginalRevision(input.repositoryId, input.baseCommitSha);
    if (existing !== undefined) {
      return existing;
    }
    try {
      const row = await this.client.repositoryRevision.create({
        data: {
          id: createId(),
          projectId: input.projectId,
          repositoryId: input.repositoryId,
          baseCommitSha: input.baseCommitSha.toLowerCase(),
          type: "ORIGINAL",
          contentHash: `git:${input.baseCommitSha.toLowerCase()}`,
        },
      });
      return mapRevision(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async createQueued(input: {
    projectId: string;
    migrationPlanId: string;
    repositoryId: string;
    originalRevisionId: string;
    baseCommitSha: string;
    engineVersion: string;
    idempotencyKey: string;
  }): Promise<ChangeSetRecord> {
    try {
      const row = await this.client.$transaction(async (tx) => {
        const created = await tx.changeSet.create({
          data: {
            id: createId(),
            projectId: input.projectId,
            migrationPlanId: input.migrationPlanId,
            repositoryId: input.repositoryId,
            originalRevisionId: input.originalRevisionId,
            baseCommitSha: input.baseCommitSha.toLowerCase(),
            engineVersion: input.engineVersion,
            status: "QUEUED",
            idempotencyKey: input.idempotencyKey,
          },
        });
        await tx.changeSetStatusEvent.create({
          data: {
            id: createId(),
            changeSetId: created.id,
            fromStatus: null,
            toStatus: "QUEUED",
            reason: "changeset requested",
          },
        });
        return created;
      });
      return mapChangeSet(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async transition(input: {
    changeSetId: string;
    fromStatus: ChangeSetStatus;
    toStatus: ChangeSetStatus;
    reason: string;
    errorCode?: string | null;
    errorMessage?: string | null;
  }): Promise<ChangeSetRecord> {
    assertChangeSetTransition(input.fromStatus, input.toStatus);
    const now = new Date();
    try {
      const row = await this.client.$transaction(async (tx) => {
        const updated = await tx.changeSet.update({
          where: { id: input.changeSetId },
          data: {
            status: input.toStatus,
            ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
            ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
            ...(input.toStatus === "FINALIZED" ? { finalizedAt: now } : {}),
            ...(input.toStatus === "FAILED"
              ? { errorCode: input.errorCode ?? "CHANGESET_FAILED" }
              : {}),
          },
        });
        await tx.changeSetStatusEvent.create({
          data: {
            id: createId(),
            changeSetId: input.changeSetId,
            fromStatus: input.fromStatus,
            toStatus: input.toStatus,
            reason: input.reason,
          },
        });
        return updated;
      });
      return mapChangeSet(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async persistGenerated(
    changeSetId: string,
    changes: PersistGeneratedChange[],
  ): Promise<ChangeSetRecord> {
    const counts = {
      totalChanges: changes.length,
      proposedCount: changes.filter((item) => item.status === "PROPOSED").length,
      acceptedCount: 0,
      rejectedCount: 0,
      skippedCount: changes.filter((item) => item.status === "SKIPPED").length,
      failedCount: changes.filter((item) => item.status === "FAILED").length,
    };
    try {
      const row = await this.client.$transaction(async (tx) => {
        await tx.changeSetChange.deleteMany({ where: { changeSetId } });
        if (changes.length > 0) {
          await tx.changeSetChange.createMany({
            data: changes.map((change) => ({
              id: createId(),
              changeSetId,
              ...change,
            })),
          });
        }
        return tx.changeSet.update({
          where: { id: changeSetId },
          data: counts,
        });
      });
      return mapChangeSet(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async setChangeStatus(
    changeId: string,
    status: "ACCEPTED" | "REJECTED",
  ): Promise<boolean> {
    const change = await this.client.changeSetChange.findUnique({ where: { id: changeId } });
    if (change === null || change.status !== "PROPOSED") {
      return false;
    }
    await this.client.changeSetChange.update({ where: { id: changeId }, data: { status } });
    await this.refreshCounts(change.changeSetId);
    return true;
  }

  public async acceptAllProposed(changeSetId: string): Promise<number> {
    const result = await this.client.changeSetChange.updateMany({
      where: { changeSetId, status: "PROPOSED" },
      data: { status: "ACCEPTED" },
    });
    await this.refreshCounts(changeSetId);
    return result.count;
  }

  public async skipRemainingProposed(changeSetId: string): Promise<number> {
    const result = await this.client.changeSetChange.updateMany({
      where: { changeSetId, status: "PROPOSED" },
      data: { status: "SKIPPED", skipReason: "NOT_ACCEPTED" },
    });
    await this.refreshCounts(changeSetId);
    return result.count;
  }

  public async findGeneratedByChangeSet(
    changeSetId: string,
  ): Promise<RepositoryRevision | undefined> {
    const row = await this.client.repositoryRevision.findUnique({ where: { changeSetId } });
    return row === null ? undefined : mapRevision(row);
  }

  public async createGeneratedRevision(input: {
    id: string;
    projectId: string;
    repositoryId: string;
    baseRevisionId: string;
    baseCommitSha: string;
    changeSetId: string;
    contentHash: string;
    completeness: RevisionCompleteness;
  }): Promise<RepositoryRevision> {
    try {
      const row = await this.client.repositoryRevision.create({
        data: {
          id: input.id,
          projectId: input.projectId,
          repositoryId: input.repositoryId,
          baseRevisionId: input.baseRevisionId,
          baseCommitSha: input.baseCommitSha,
          type: "GENERATED",
          changeSetId: input.changeSetId,
          contentHash: input.contentHash,
          completeness: input.completeness,
        },
      });
      return mapRevision(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async setCompleteness(
    changeSetId: string,
    completeness: RevisionCompleteness,
  ): Promise<void> {
    await this.client.changeSet.update({
      where: { id: changeSetId },
      data: { completeness },
    });
  }

  public async setActiveRevision(projectId: string, revisionId: string | null): Promise<void> {
    await this.client.project.update({
      where: { id: projectId },
      data: { activeRevisionId: revisionId },
    });
  }

  public async setActiveRevisionIfEmpty(projectId: string, revisionId: string): Promise<void> {
    await this.client.project.updateMany({
      where: { id: projectId, activeRevisionId: null },
      data: { activeRevisionId: revisionId },
    });
  }

  public async getDetails(id: string) {
    return this.client.changeSet.findUnique({
      where: { id },
      include: {
        changes: {
          orderBy: { createdAt: "asc" },
          include: {
            migrationAction: {
              include: { evidence: { orderBy: { startLine: "asc" } } },
            },
          },
        },
        statusEvents: { orderBy: { createdAt: "asc" } },
        originalRevision: true,
        generatedRevision: true,
        migrationPlan: true,
      },
    });
  }

  public async getChange(changeSetId: string, changeId: string) {
    return this.client.changeSetChange.findFirst({
      where: { id: changeId, changeSetId },
    });
  }

  public async listAccepted(changeSetId: string) {
    return this.client.changeSetChange.findMany({
      where: { changeSetId, status: "ACCEPTED" },
      orderBy: { createdAt: "asc" },
    });
  }

  public async getRevision(id: string): Promise<RepositoryRevision | undefined> {
    const row = await this.client.repositoryRevision.findUnique({ where: { id } });
    return row === null ? undefined : mapRevision(row);
  }

  private async refreshCounts(changeSetId: string): Promise<void> {
    const counts = await this.client.changeSetChange.groupBy({
      by: ["status"],
      where: { changeSetId },
      _count: { status: true },
    });
    const countOf = (status: ChangeStatus): number =>
      counts.find((item) => item.status === status)?._count.status ?? 0;
    await this.client.changeSet.update({
      where: { id: changeSetId },
      data: {
        proposedCount: countOf("PROPOSED"),
        acceptedCount: countOf("ACCEPTED"),
        rejectedCount: countOf("REJECTED"),
        skippedCount: countOf("SKIPPED"),
        failedCount: countOf("FAILED"),
      },
    });
  }
}

function mapChangeSet(row: {
  id: string;
  projectId: string;
  migrationPlanId: string;
  repositoryId: string;
  originalRevisionId: string;
  baseCommitSha: string;
  engineVersion: string;
  status: ChangeSetRecord["status"];
  completeness: ChangeSetRecord["completeness"];
  totalChanges: number;
  proposedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  skippedCount: number;
  failedCount: number;
  idempotencyKey: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  finalizedAt: Date | null;
  updatedAt: Date;
}): ChangeSetRecord {
  return row;
}

function mapRevision(row: {
  id: string;
  projectId: string;
  repositoryId: string;
  baseRevisionId: string | null;
  baseCommitSha: string;
  type: RepositoryRevision["type"];
  changeSetId: string | null;
  contentHash: string;
  completeness: RepositoryRevision["completeness"];
  createdAt: Date;
}): RepositoryRevision {
  return row;
}
