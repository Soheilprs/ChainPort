import type { ChangeSetRecord } from "@chainport/shared";

import type { ChangeSetService } from "../changeset-service.js";
import type { AccessControl } from "../access.js";
import type { ApiInstance } from "../types.js";

export function registerChangeSetRoutes(
  app: ApiInstance,
  service: ChangeSetService,
  access?: AccessControl,
): void {
  app.post<{ Params: { id: string } }>(
    "/v1/migration-plans/:id/change-sets",
    async (request, reply) => {
      const result = await service.createForPlan(request.params.id);
      return reply
        .status(result.created ? 201 : 200)
        .send({ data: presentChangeSet(result.changeSet) });
    },
  );

  app.get<{ Params: { id: string } }>("/v1/migration-plans/:id/change-sets", async (request) => {
    const items = await service.listForPlan(request.params.id);
    return { data: items.map(presentChangeSet) };
  });

  app.get<{ Params: { id: string } }>("/v1/change-sets/:id", async (request) => {
    const details = await service.get(request.params.id);
    if (access !== undefined) {
      await access.requireProject(request.actor, details.projectId);
    }
    return { data: presentDetails(details) };
  });

  app.get<{ Params: { id: string } }>("/v1/change-sets/:id/changes", async (request) => {
    const details = await service.get(request.params.id);
    if (access !== undefined) {
      await access.requireProject(request.actor, details.projectId);
    }
    return { data: details.changes.map(presentChange) };
  });

  app.post<{ Params: { id: string; changeId: string } }>(
    "/v1/change-sets/:id/changes/:changeId/accept",
    async (request) => {
      const existing = await service.get(request.params.id);
      if (access !== undefined) {
        await access.requireProject(request.actor, existing.projectId);
      }
      await service.accept(request.params.id, request.params.changeId);
      const details = await service.get(request.params.id);
      return { data: presentDetails(details) };
    },
  );

  app.post<{ Params: { id: string; changeId: string } }>(
    "/v1/change-sets/:id/changes/:changeId/reject",
    async (request) => {
      const existing = await service.get(request.params.id);
      if (access !== undefined) {
        await access.requireProject(request.actor, existing.projectId);
      }
      await service.reject(request.params.id, request.params.changeId);
      const details = await service.get(request.params.id);
      return { data: presentDetails(details) };
    },
  );

  app.post<{ Params: { id: string } }>("/v1/change-sets/:id/accept-all", async (request) => {
    const existing = await service.get(request.params.id);
    if (access !== undefined) {
      await access.requireProject(request.actor, existing.projectId);
    }
    await service.acceptAll(request.params.id);
    const details = await service.get(request.params.id);
    return { data: presentDetails(details) };
  });

  app.post<{ Params: { id: string } }>("/v1/change-sets/:id/finalize", async (request) => {
    const existing = await service.get(request.params.id);
    if (access !== undefined) {
      await access.requireProject(request.actor, existing.projectId);
    }
    await service.finalize(request.params.id);
    const details = await service.get(request.params.id);
    return { data: presentDetails(details) };
  });

  app.post<{ Params: { id: string } }>("/v1/change-sets/:id/rollback", async (request) => {
    const existing = await service.get(request.params.id);
    if (access !== undefined) {
      await access.requireProject(request.actor, existing.projectId);
    }
    await service.rollback(request.params.id);
    const details = await service.get(request.params.id);
    return { data: presentDetails(details) };
  });
}

function presentChangeSet(changeSet: ChangeSetRecord) {
  return {
    id: changeSet.id,
    projectId: changeSet.projectId,
    migrationPlanId: changeSet.migrationPlanId,
    repositoryId: changeSet.repositoryId,
    originalRevisionId: changeSet.originalRevisionId,
    baseCommitSha: changeSet.baseCommitSha,
    engineVersion: changeSet.engineVersion,
    status: changeSet.status,
    completeness: changeSet.completeness,
    totalChanges: changeSet.totalChanges,
    proposedCount: changeSet.proposedCount,
    acceptedCount: changeSet.acceptedCount,
    rejectedCount: changeSet.rejectedCount,
    skippedCount: changeSet.skippedCount,
    failedCount: changeSet.failedCount,
    errorCode: changeSet.errorCode,
    errorMessage: changeSet.errorMessage,
    createdAt: changeSet.createdAt.toISOString(),
    finalizedAt: changeSet.finalizedAt?.toISOString() ?? null,
  };
}

function presentRevision(revision: {
  id: string;
  type: string;
  baseCommitSha: string;
  contentHash: string;
  completeness: string | null;
  changeSetId: string | null;
  baseRevisionId: string | null;
  createdAt: Date;
}) {
  return {
    id: revision.id,
    type: revision.type,
    baseCommitSha: revision.baseCommitSha,
    contentHash: revision.contentHash,
    completeness: revision.completeness,
    changeSetId: revision.changeSetId,
    baseRevisionId: revision.baseRevisionId,
    createdAt: revision.createdAt.toISOString(),
  };
}

function presentChange(change: {
  id: string;
  changeSetId: string;
  migrationActionId: string | null;
  filePath: string;
  patcherId: string | null;
  patcherVersion: string | null;
  changeType: string | null;
  status: string;
  skipReason: string | null;
  sourceHash: string | null;
  resultHash: string | null;
  beforeExcerpt: string | null;
  afterExcerpt: string | null;
  unifiedDiff: string | null;
  sourceValue: string | null;
  targetValue: string | null;
  reason: string;
  migrationAction?: {
    title: string;
    category: string;
    automationLevel: string;
    riskLevel: string;
    semanticKey: string;
    evidence: Array<{ id: string; filePath: string; startLine: number; excerpt: string }>;
  } | null;
}) {
  return {
    id: change.id,
    changeSetId: change.changeSetId,
    migrationActionId: change.migrationActionId,
    filePath: change.filePath,
    changeType: change.changeType,
    status: change.status,
    skipReason: change.skipReason,
    sourceHash: change.sourceHash,
    resultHash: change.resultHash,
    beforeExcerpt: change.beforeExcerpt,
    afterExcerpt: change.afterExcerpt,
    unifiedDiff: change.unifiedDiff,
    sourceValue: change.sourceValue,
    targetValue: change.targetValue,
    reason: change.reason,
    patcher:
      change.patcherId === null ? null : { id: change.patcherId, version: change.patcherVersion },
    automationLevel: change.migrationAction?.automationLevel ?? null,
    riskLevel: change.migrationAction?.riskLevel ?? null,
    title: change.migrationAction?.title ?? null,
    category: change.migrationAction?.category ?? null,
    semanticKey: change.migrationAction?.semanticKey ?? null,
    evidence: (change.migrationAction?.evidence ?? []).map((entry) => ({
      id: entry.id,
      filePath: entry.filePath,
      startLine: entry.startLine,
      excerpt: entry.excerpt,
    })),
  };
}

function presentDetails(details: Awaited<ReturnType<ChangeSetService["get"]>>) {
  return {
    changeSet: presentChangeSet(details),
    plan: {
      id: details.migrationPlan.id,
      projectId: details.migrationPlan.projectId,
      sourceChainKey: details.migrationPlan.sourceChainKey,
      targetChainKey: details.migrationPlan.targetChainKey,
      commitSha: details.migrationPlan.commitSha,
      safeActionCount: details.migrationPlan.safeActionCount,
    },
    originalRevision: presentRevision(details.originalRevision),
    generatedRevision:
      details.generatedRevision === null ? null : presentRevision(details.generatedRevision),
    changes: details.changes.map(presentChange),
    events: details.statusEvents.map((event) => ({
      id: event.id,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      reason: event.reason,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}
