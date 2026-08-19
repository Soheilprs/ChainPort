import type { MigrationPlanResult } from "@chainport/migration";
import { assertMigrationPlanTransition, createId, type PlannedMigration } from "@chainport/shared";

import type { DatabaseClient } from "./client.js";
import { rethrowPersistenceError } from "./client.js";

export class PlanRepository {
  public constructor(private readonly client: DatabaseClient) {}

  public async findByIdempotencyKey(key: string): Promise<PlannedMigration | undefined> {
    const row = await this.client.plannedMigration.findUnique({ where: { idempotencyKey: key } });
    return row === null ? undefined : mapPlan(row);
  }

  public async getById(id: string): Promise<PlannedMigration | undefined> {
    const row = await this.client.plannedMigration.findUnique({ where: { id } });
    return row === null ? undefined : mapPlan(row);
  }

  public async listForCompatibilityRun(compatibilityRunId: string): Promise<PlannedMigration[]> {
    const rows = await this.client.plannedMigration.findMany({
      where: { compatibilityRunId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapPlan);
  }

  public async createQueued(input: {
    projectId: string;
    compatibilityRunId: string;
    repositoryId: string;
    commitSha: string;
    sourceChainKey: string;
    targetChainKey: string;
    registrySnapshotHash: string;
    migrationRulesetVersion: string;
    idempotencyKey: string;
  }): Promise<PlannedMigration> {
    try {
      const row = await this.client.$transaction(async (tx) => {
        const created = await tx.plannedMigration.create({
          data: {
            id: createId(),
            projectId: input.projectId,
            compatibilityRunId: input.compatibilityRunId,
            repositoryId: input.repositoryId,
            commitSha: input.commitSha,
            sourceChainKey: input.sourceChainKey,
            targetChainKey: input.targetChainKey,
            registrySnapshotHash: input.registrySnapshotHash,
            migrationRulesetVersion: input.migrationRulesetVersion,
            status: "QUEUED",
            outcome: "READY_TO_APPLY",
            migrationReady: false,
            verificationRequired: false,
            idempotencyKey: input.idempotencyKey,
          },
        });
        await tx.plannedMigrationStatusEvent.create({
          data: {
            id: createId(),
            planId: created.id,
            fromStatus: null,
            toStatus: "QUEUED",
            reason: "migration plan requested",
          },
        });
        return created;
      });
      return mapPlan(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async persistCompleted(
    planId: string,
    result: MigrationPlanResult,
  ): Promise<PlannedMigration> {
    const now = new Date();
    try {
      const row = await this.client.$transaction(async (tx) => {
        const current = await tx.plannedMigration.findUniqueOrThrow({ where: { id: planId } });
        if (current.status === "COMPLETED") {
          return current;
        }
        if (current.status === "QUEUED") {
          assertMigrationPlanTransition("QUEUED", "PLANNING");
          await tx.plannedMigrationStatusEvent.create({
            data: {
              id: createId(),
              planId,
              fromStatus: "QUEUED",
              toStatus: "PLANNING",
              reason: "generating migration actions",
            },
          });
        } else if (current.status === "FAILED") {
          assertMigrationPlanTransition("FAILED", "QUEUED");
          assertMigrationPlanTransition("QUEUED", "PLANNING");
          await tx.plannedMigrationStatusEvent.create({
            data: {
              id: createId(),
              planId,
              fromStatus: "FAILED",
              toStatus: "QUEUED",
              reason: "retrying failed migration plan",
            },
          });
          await tx.plannedMigrationStatusEvent.create({
            data: {
              id: createId(),
              planId,
              fromStatus: "QUEUED",
              toStatus: "PLANNING",
              reason: "generating migration actions",
            },
          });
        }
        assertMigrationPlanTransition("PLANNING", "COMPLETED");
        await tx.plannedMigrationAction.deleteMany({ where: { planId } });
        const actionIds = new Map<string, string>();
        for (const action of result.actions) {
          const id = createId();
          actionIds.set(action.key, id);
          await tx.plannedMigrationAction.create({
            data: {
              id,
              planId,
              semanticKey: action.key,
              ruleId: action.ruleId,
              ruleVersion: action.ruleVersion,
              title: action.title,
              description: action.description,
              technicalReason: action.technicalReason,
              category: action.category,
              stage: action.stage,
              automationLevel: action.automationLevel,
              riskLevel: action.riskLevel,
              actionStatus: action.actionStatus,
              sourceValue: action.sourceValue,
              targetValue: action.targetValue,
              displayOrder: action.displayOrder,
              dependencyOrder: action.dependencyOrder,
              registryRefs: action.registryRefs,
              evidence: {
                create: action.evidence
                  .filter((item) => item.filePath.length > 0)
                  .map((item) => ({
                    id: createId(),
                    findingId: item.findingId,
                    evidenceId: item.evidenceId,
                    filePath: item.filePath,
                    startLine: item.startLine,
                    excerpt: item.excerpt,
                  })),
              },
            },
          });
        }
        for (const edge of result.dependencies) {
          const actionId = actionIds.get(edge.actionKey);
          const dependsOnActionId = actionIds.get(edge.dependsOnKey);
          if (actionId === undefined || dependsOnActionId === undefined) {
            continue;
          }
          await tx.plannedMigrationActionDependency.create({
            data: {
              id: createId(),
              actionId,
              dependsOnActionId,
            },
          });
        }
        const updated = await tx.plannedMigration.update({
          where: { id: planId },
          data: {
            status: "COMPLETED",
            outcome: result.outcome,
            migrationReady: result.migrationReady,
            totalActions: result.counts.total,
            safeActionCount: result.counts.safeAutomatic,
            reviewActionCount: result.counts.reviewRequired,
            manualActionCount: result.counts.manual,
            blockedActionCount: result.counts.blocked,
            unknownActionCount: result.counts.unknown,
            autoFixablePercent: result.autoFixablePercent,
            verificationRequired: result.verificationRequired,
            errorCode: null,
            errorMessage: null,
            completedAt: now,
          },
        });
        await tx.plannedMigrationStatusEvent.create({
          data: {
            id: createId(),
            planId,
            fromStatus: "PLANNING",
            toStatus: "COMPLETED",
            reason: "migration plan completed",
          },
        });
        return updated;
      });
      return mapPlan(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async markFailed(
    planId: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<PlannedMigration> {
    const now = new Date();
    try {
      const row = await this.client.$transaction(async (tx) => {
        const current = await tx.plannedMigration.findUniqueOrThrow({ where: { id: planId } });
        const fromStatus = current.status;
        if (fromStatus !== "FAILED") {
          assertMigrationPlanTransition(fromStatus, "FAILED");
        }
        const updated = await tx.plannedMigration.update({
          where: { id: planId },
          data: {
            status: "FAILED",
            errorCode,
            errorMessage,
            completedAt: now,
          },
        });
        if (fromStatus !== "FAILED") {
          await tx.plannedMigrationStatusEvent.create({
            data: {
              id: createId(),
              planId,
              fromStatus,
              toStatus: "FAILED",
              reason: errorMessage,
            },
          });
        }
        return updated;
      });
      return mapPlan(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async getDetails(id: string) {
    return this.client.plannedMigration.findUnique({
      where: { id },
      include: {
        actions: {
          orderBy: { displayOrder: "asc" },
          include: {
            evidence: { orderBy: { startLine: "asc" } },
            outgoing: true,
          },
        },
        statusEvents: { orderBy: { createdAt: "asc" } },
      },
    });
  }
}

function mapPlan(row: {
  id: string;
  projectId: string;
  compatibilityRunId: string;
  repositoryId: string;
  commitSha: string;
  sourceChainKey: string;
  targetChainKey: string;
  registrySnapshotHash: string;
  migrationRulesetVersion: string;
  status: PlannedMigration["status"];
  outcome: PlannedMigration["outcome"];
  migrationReady: boolean;
  totalActions: number;
  safeActionCount: number;
  reviewActionCount: number;
  manualActionCount: number;
  blockedActionCount: number;
  unknownActionCount: number;
  autoFixablePercent: number;
  verificationRequired: boolean;
  idempotencyKey: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
  updatedAt: Date;
}): PlannedMigration {
  return row;
}
