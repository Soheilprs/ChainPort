import { getChainByKey } from "@chainport/chain-registry";
import {
  UniqueConstraintError,
  type CompatibilityRepository,
  type PlanRepository,
} from "@chainport/db";
import {
  createMigrationPlan,
  MIGRATION_RULESET_VERSION,
  type PlannedFinding,
} from "@chainport/migration";
import {
  buildMigrationPlanIdempotencyKey,
  isJsonObject,
  MIGRATION_PLAN_ERROR_MESSAGES,
  type PlannedMigration,
} from "@chainport/shared";

import { ApiRequestError } from "./errors.js";

function rpcUrlsFromSnapshot(canonicalJson: string): string[] {
  try {
    const parsed: unknown = JSON.parse(canonicalJson);
    if (!isJsonObject(parsed) || !Array.isArray(parsed.rpcUrls)) {
      return [];
    }
    return parsed.rpcUrls.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export class PlanService {
  public constructor(
    private readonly compatibility: CompatibilityRepository,
    private readonly plans: PlanRepository,
  ) {}

  public async createForCompatibilityRun(
    compatibilityRunId: string,
  ): Promise<{ plan: PlannedMigration; created: boolean }> {
    const details = await this.compatibility.getDetails(compatibilityRunId);
    if (details === null) {
      throw new ApiRequestError(
        404,
        "COMPATIBILITY_NOT_FOUND",
        MIGRATION_PLAN_ERROR_MESSAGES.COMPATIBILITY_NOT_FOUND,
      );
    }
    if (details.status !== "COMPLETED") {
      throw new ApiRequestError(
        409,
        "COMPATIBILITY_NOT_COMPLETE",
        MIGRATION_PLAN_ERROR_MESSAGES.COMPATIBILITY_NOT_COMPLETE,
      );
    }

    const source = getChainByKey(details.sourceChainKey);
    const target = getChainByKey(details.targetChainKey);
    const idempotencyKey = buildMigrationPlanIdempotencyKey({
      compatibilityRunId: details.id,
      migrationRulesetVersion: MIGRATION_RULESET_VERSION,
    });
    const existing = await this.plans.findByIdempotencyKey(idempotencyKey);
    if (existing?.status === "COMPLETED") {
      return { plan: existing, created: false };
    }

    let plan = existing;
    if (plan === undefined) {
      try {
        plan = await this.plans.createQueued({
          projectId: details.projectId,
          compatibilityRunId: details.id,
          repositoryId: details.repositoryId,
          commitSha: details.commitSha,
          sourceChainKey: details.sourceChainKey,
          targetChainKey: details.targetChainKey,
          registrySnapshotHash: details.registrySnapshotHash,
          migrationRulesetVersion: MIGRATION_RULESET_VERSION,
          idempotencyKey,
        });
      } catch (error) {
        if (!(error instanceof UniqueConstraintError)) {
          throw error;
        }
        const raced = await this.plans.findByIdempotencyKey(idempotencyKey);
        if (raced?.status === "COMPLETED") {
          return { plan: raced, created: false };
        }
        if (raced === undefined) {
          throw error;
        }
        plan = raced;
      }
    }

    try {
      const findings: PlannedFinding[] = details.findings.map((item) => ({
        id: item.id,
        requirementId: item.requirementId,
        requirementKey: item.requirement?.key ?? null,
        ruleId: item.ruleId,
        ruleVersion: item.ruleVersion,
        category: item.category,
        status: item.status,
        title: item.title,
        summary: item.summary,
        technicalReason: item.technicalReason,
        remediationType: item.remediationType,
        sourceValue: item.sourceValue,
        targetValue: item.targetValue,
        confidence:
          item.confidence === "HIGH" || item.confidence === "MEDIUM" || item.confidence === "LOW"
            ? item.confidence
            : "LOW",
        registryEvidence: isJsonObject(item.registryEvidence) ? item.registryEvidence : {},
        evidence: (item.requirement?.evidence ?? []).map((entry) => ({
          findingId: item.id,
          evidenceId: entry.id,
          filePath: entry.filePath,
          startLine: entry.startLine,
          excerpt: entry.excerpt,
        })),
      }));
      const result = createMigrationPlan({
        context: {
          sourceChainKey: details.sourceChainKey,
          sourceChainName: source?.name ?? details.sourceChainKey,
          sourceChainId: source?.chainId ?? 0,
          targetChainKey: details.targetChainKey,
          targetChainName: target?.name ?? details.targetChainKey,
          targetChainId: target?.chainId ?? 0,
          targetRpcUrls: rpcUrlsFromSnapshot(details.registrySnapshot.canonicalJson),
          targetExplorerUrl: null,
          registrySnapshotHash: details.registrySnapshotHash,
        },
        findings,
      });
      const completed = await this.plans.persistCompleted(plan.id, result);
      return { plan: completed, created: existing === undefined };
    } catch (error) {
      if (error instanceof ApiRequestError) {
        throw error;
      }
      await this.plans.markFailed(
        plan.id,
        "PLANNING_FAILED",
        MIGRATION_PLAN_ERROR_MESSAGES.PLANNING_FAILED,
      );
      throw error;
    }
  }

  public async listForCompatibilityRun(compatibilityRunId: string) {
    const run = await this.compatibility.getById(compatibilityRunId);
    if (run === undefined) {
      throw new ApiRequestError(
        404,
        "COMPATIBILITY_NOT_FOUND",
        MIGRATION_PLAN_ERROR_MESSAGES.COMPATIBILITY_NOT_FOUND,
      );
    }
    return this.plans.listForCompatibilityRun(compatibilityRunId);
  }

  public async get(id: string) {
    const details = await this.plans.getDetails(id);
    if (details === null) {
      throw new ApiRequestError(
        404,
        "PLAN_NOT_FOUND",
        MIGRATION_PLAN_ERROR_MESSAGES.PLAN_NOT_FOUND,
      );
    }
    return details;
  }
}
