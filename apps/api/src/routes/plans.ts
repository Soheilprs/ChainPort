import { asJsonObject } from "@chainport/db";
import { MIGRATION_STAGES, type PlannedMigration } from "@chainport/shared";

import type { PlanService } from "../plan-service.js";
import type { ApiInstance } from "../types.js";

export function registerPlanRoutes(app: ApiInstance, service: PlanService): void {
  app.post<{ Params: { id: string } }>(
    "/v1/compatibility-runs/:id/migration-plans",
    async (request, reply) => {
      const result = await service.createForCompatibilityRun(request.params.id);
      return reply.status(result.created ? 201 : 200).send({ data: presentPlan(result.plan) });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/v1/compatibility-runs/:id/migration-plans",
    async (request) => {
      const plans = await service.listForCompatibilityRun(request.params.id);
      return { data: plans.map(presentPlan) };
    },
  );

  app.get<{ Params: { id: string } }>("/v1/migration-plans/:id", async (request) => {
    const details = await service.get(request.params.id);
    const actions = details.actions.map((action) => ({
      id: action.id,
      semanticKey: action.semanticKey,
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
      registryRefs: asJsonObject(action.registryRefs),
      evidence: action.evidence.map((entry) => ({
        id: entry.id,
        findingId: entry.findingId,
        evidenceId: entry.evidenceId,
        filePath: entry.filePath,
        startLine: entry.startLine,
        excerpt: entry.excerpt,
      })),
      dependsOnActionIds: action.outgoing.map((edge) => edge.dependsOnActionId),
    }));
    const usedStages = MIGRATION_STAGES.filter((stage) =>
      actions.some((action) => action.stage === stage),
    );
    return {
      data: {
        plan: presentPlan(details),
        stages: usedStages.map((stage) => ({
          stage,
          actions: actions.filter((action) => action.stage === stage),
        })),
        actions,
        dependencies: details.actions.flatMap((action) =>
          action.outgoing.map((edge) => ({
            actionId: edge.actionId,
            dependsOnActionId: edge.dependsOnActionId,
          })),
        ),
        events: details.statusEvents.map((event) => ({
          id: event.id,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          reason: event.reason,
          createdAt: event.createdAt.toISOString(),
        })),
      },
    };
  });

  app.get<{ Params: { id: string } }>("/v1/migration-plans/:id/actions", async (request) => {
    const details = await service.get(request.params.id);
    return {
      data: details.actions.map((action) => ({
        id: action.id,
        title: action.title,
        stage: action.stage,
        automationLevel: action.automationLevel,
        riskLevel: action.riskLevel,
        actionStatus: action.actionStatus,
        sourceValue: action.sourceValue,
        targetValue: action.targetValue,
      })),
    };
  });
}

function presentPlan(plan: PlannedMigration) {
  return {
    id: plan.id,
    projectId: plan.projectId,
    compatibilityRunId: plan.compatibilityRunId,
    repositoryId: plan.repositoryId,
    commitSha: plan.commitSha,
    sourceChainKey: plan.sourceChainKey,
    targetChainKey: plan.targetChainKey,
    registrySnapshotHash: plan.registrySnapshotHash,
    migrationRulesetVersion: plan.migrationRulesetVersion,
    status: plan.status,
    outcome: plan.outcome,
    migrationReady: plan.migrationReady,
    totalActions: plan.totalActions,
    safeActionCount: plan.safeActionCount,
    reviewActionCount: plan.reviewActionCount,
    manualActionCount: plan.manualActionCount,
    blockedActionCount: plan.blockedActionCount,
    unknownActionCount: plan.unknownActionCount,
    autoFixablePercent: plan.autoFixablePercent,
    verificationRequired: plan.verificationRequired,
    errorCode: plan.errorCode,
    errorMessage: plan.errorMessage,
    createdAt: plan.createdAt.toISOString(),
    completedAt: plan.completedAt?.toISOString() ?? null,
  };
}
