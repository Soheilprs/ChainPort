import {
  UniqueConstraintError,
  type ChangeSetRepository,
  type PlanRepository,
} from "@chainport/db";
import {
  buildChangeSetIdempotencyKey,
  CHANGESET_ENGINE_VERSION,
  CHANGESET_ERROR_MESSAGES,
  type ChangeSetRecord,
} from "@chainport/shared";

import { ApiRequestError } from "./errors.js";
import type { JobQueue } from "./queue.js";

export class ChangeSetService {
  public constructor(
    private readonly plans: PlanRepository,
    private readonly changeSets: ChangeSetRepository,
    private readonly queue: JobQueue,
  ) {}

  public async createForPlan(
    planId: string,
  ): Promise<{ changeSet: ChangeSetRecord; created: boolean }> {
    const plan = await this.plans.getById(planId);
    if (plan === undefined) {
      throw new ApiRequestError(404, "PLAN_NOT_FOUND", CHANGESET_ERROR_MESSAGES.PLAN_NOT_FOUND);
    }
    if (plan.status !== "COMPLETED") {
      throw new ApiRequestError(
        409,
        "PLAN_NOT_COMPLETE",
        CHANGESET_ERROR_MESSAGES.PLAN_NOT_COMPLETE,
      );
    }
    const idempotencyKey = buildChangeSetIdempotencyKey({
      migrationPlanId: plan.id,
      originalCommitSha: plan.commitSha,
      engineVersion: CHANGESET_ENGINE_VERSION,
    });
    const existing = await this.changeSets.findByIdempotencyKey(idempotencyKey);
    if (existing !== undefined) {
      if (existing.status === "QUEUED" || existing.status === "FAILED") {
        await this.queue.enqueueGenerateChangeSet(existing.id);
      }
      return { changeSet: existing, created: false };
    }
    const original = await this.changeSets.createOriginalRevision({
      projectId: plan.projectId,
      repositoryId: plan.repositoryId,
      baseCommitSha: plan.commitSha,
    });
    await this.changeSets.setActiveRevisionIfEmpty(plan.projectId, original.id);
    try {
      const changeSet = await this.changeSets.createQueued({
        projectId: plan.projectId,
        migrationPlanId: plan.id,
        repositoryId: plan.repositoryId,
        originalRevisionId: original.id,
        baseCommitSha: plan.commitSha,
        engineVersion: CHANGESET_ENGINE_VERSION,
        idempotencyKey,
      });
      await this.queue.enqueueGenerateChangeSet(changeSet.id);
      return { changeSet, created: true };
    } catch (error) {
      if (!(error instanceof UniqueConstraintError)) {
        throw error;
      }
      const raced = await this.changeSets.findByIdempotencyKey(idempotencyKey);
      if (raced === undefined) {
        throw error;
      }
      return { changeSet: raced, created: false };
    }
  }

  public async listForPlan(planId: string) {
    const plan = await this.plans.getById(planId);
    if (plan === undefined) {
      throw new ApiRequestError(404, "PLAN_NOT_FOUND", CHANGESET_ERROR_MESSAGES.PLAN_NOT_FOUND);
    }
    return this.changeSets.listForPlan(planId);
  }

  public async get(id: string) {
    const details = await this.changeSets.getDetails(id);
    if (details === null) {
      throw new ApiRequestError(
        404,
        "CHANGESET_NOT_FOUND",
        CHANGESET_ERROR_MESSAGES.CHANGESET_NOT_FOUND,
      );
    }
    return details;
  }

  public async accept(changeSetId: string, changeId: string): Promise<void> {
    await this.decide(changeSetId, changeId, "ACCEPTED");
  }

  public async reject(changeSetId: string, changeId: string): Promise<void> {
    await this.decide(changeSetId, changeId, "REJECTED");
  }

  public async acceptAll(changeSetId: string): Promise<number> {
    await this.requireReview(changeSetId);
    return this.changeSets.acceptAllProposed(changeSetId);
  }

  public async finalize(changeSetId: string): Promise<ChangeSetRecord> {
    const record = await this.requireChangeSet(changeSetId);
    if (record.status === "FINALIZED" || record.status === "FINALIZING") {
      return record;
    }
    if (record.status !== "READY_FOR_REVIEW") {
      throw new ApiRequestError(
        409,
        "CHANGESET_NOT_ELIGIBLE",
        CHANGESET_ERROR_MESSAGES.CHANGESET_NOT_ELIGIBLE,
      );
    }
    await this.queue.enqueueFinalizeChangeSet(changeSetId);
    return record;
  }

  public async rollback(changeSetId: string): Promise<ChangeSetRecord> {
    const record = await this.requireChangeSet(changeSetId);
    if (record.status === "ROLLED_BACK") {
      return record;
    }
    if (record.status !== "FINALIZED") {
      throw new ApiRequestError(
        409,
        "CHANGESET_NOT_ELIGIBLE",
        CHANGESET_ERROR_MESSAGES.CHANGESET_NOT_ELIGIBLE,
      );
    }
    await this.changeSets.setActiveRevision(record.projectId, record.originalRevisionId);
    return this.changeSets.transition({
      changeSetId,
      fromStatus: "FINALIZED",
      toStatus: "ROLLED_BACK",
      reason: "generated revision abandoned; original selected",
    });
  }

  private async requireChangeSet(id: string): Promise<ChangeSetRecord> {
    const record = await this.changeSets.getById(id);
    if (record === undefined) {
      throw new ApiRequestError(
        404,
        "CHANGESET_NOT_FOUND",
        CHANGESET_ERROR_MESSAGES.CHANGESET_NOT_FOUND,
      );
    }
    return record;
  }

  private async requireReview(id: string): Promise<ChangeSetRecord> {
    const record = await this.requireChangeSet(id);
    if (record.status !== "READY_FOR_REVIEW") {
      throw new ApiRequestError(
        409,
        "CHANGESET_NOT_ELIGIBLE",
        CHANGESET_ERROR_MESSAGES.CHANGESET_NOT_ELIGIBLE,
      );
    }
    return record;
  }

  private async decide(
    changeSetId: string,
    changeId: string,
    status: "ACCEPTED" | "REJECTED",
  ): Promise<void> {
    await this.requireChangeSet(changeSetId);
    const change = await this.changeSets.getChange(changeSetId, changeId);
    if (change === null) {
      throw new ApiRequestError(404, "CHANGE_NOT_FOUND", CHANGESET_ERROR_MESSAGES.CHANGE_NOT_FOUND);
    }
    await this.requireReview(changeSetId);
    const updated = await this.changeSets.setChangeStatus(changeId, status);
    if (!updated) {
      throw new ApiRequestError(
        409,
        "CHANGESET_NOT_ELIGIBLE",
        CHANGESET_ERROR_MESSAGES.CHANGESET_NOT_ELIGIBLE,
      );
    }
  }
}
