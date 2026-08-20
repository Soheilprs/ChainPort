import { getChainByKey, listDeploymentTargets, toChainSummary } from "@chainport/chain-registry";
import {
  UniqueConstraintError,
  type ChangeSetRepository,
  type DeploymentRepository,
  type PlanRepository,
  type ValidationRepository,
} from "@chainport/db";
import {
  evaluateEligibility,
  rejectArbitraryCommand,
  requireDeploymentTarget,
} from "@chainport/deployment";
import { SANDBOX_IMAGE_TAGS } from "@chainport/sandbox";
import {
  buildDeploymentPrepareKey,
  DEPLOYMENT_ENGINE_VERSION,
  DEPLOYMENT_ERROR_MESSAGES,
  DEPLOYMENT_PROFILE_ID,
  DEPLOYMENT_PROFILE_VERSION,
  type DeploymentRunRecord,
  type JsonObject,
} from "@chainport/shared";

import { ApiRequestError } from "./errors.js";
import type { JobQueue } from "./queue.js";

export class DeploymentService {
  public constructor(
    private readonly revisions: ChangeSetRepository,
    private readonly plans: PlanRepository,
    private readonly validations: ValidationRepository,
    private readonly deployments: DeploymentRepository,
    private readonly queue: JobQueue,
    private readonly images: { inspectDigest(image: string): Promise<string> },
    private readonly limits: JsonObject,
  ) {}

  public listTargets() {
    return listDeploymentTargets().map((chain) => ({
      ...toChainSummary(chain),
      parentChainKey: chain.parentChainKey ?? null,
      testnetOf: chain.testnetOf ?? null,
      deploymentTestnetKey: chain.deploymentTestnetKey ?? null,
      nativeCurrency: chain.nativeCurrency,
      explorers: chain.explorers,
      deployment: chain.deployment ?? null,
    }));
  }

  public getTarget(key: string) {
    const chain = getChainByKey(key);
    if (chain === undefined) {
      throw new ApiRequestError(404, "UNKNOWN_DEPLOYMENT_TARGET", "Chain not found");
    }
    return {
      ...toChainSummary(chain),
      parentChainKey: chain.parentChainKey ?? null,
      testnetOf: chain.testnetOf ?? null,
      deploymentTestnetKey: chain.deploymentTestnetKey ?? null,
      nativeCurrency: chain.nativeCurrency,
      rpcCount: chain.rpcUrls.length,
      explorers: chain.explorers,
      deployment: chain.deployment ?? null,
    };
  }

  public async listCandidates(revisionId: string) {
    const revision = await this.revisions.getRevision(revisionId);
    if (revision === undefined) {
      throw new ApiRequestError(
        404,
        "REVISION_NOT_FOUND",
        DEPLOYMENT_ERROR_MESSAGES.REVISION_NOT_FOUND,
      );
    }
    return this.deployments.listCandidates(revisionId);
  }

  public async listForRevision(revisionId: string) {
    const revision = await this.revisions.getRevision(revisionId);
    if (revision === undefined) {
      throw new ApiRequestError(
        404,
        "REVISION_NOT_FOUND",
        DEPLOYMENT_ERROR_MESSAGES.REVISION_NOT_FOUND,
      );
    }
    return this.deployments.listForRevision(revisionId);
  }

  public async listForProject(projectId: string) {
    return this.deployments.listForProject(projectId);
  }

  public async get(id: string) {
    const details = await this.deployments.getDetails(id);
    if (details === null) {
      throw new ApiRequestError(
        404,
        "DEPLOYMENT_NOT_FOUND",
        DEPLOYMENT_ERROR_MESSAGES.DEPLOYMENT_NOT_FOUND,
      );
    }
    return details;
  }

  public async prepare(input: {
    revisionId: string;
    body: unknown;
  }): Promise<{ run: DeploymentRunRecord; created: boolean }> {
    try {
      rejectArbitraryCommand(input.body);
    } catch (error) {
      throw apiError(error);
    }
    const body = asRecord(input.body);
    const targetTestnetKey = asString(body.targetTestnetKey, "targetTestnetKey");
    let target;
    try {
      target = requireDeploymentTarget(targetTestnetKey);
    } catch (error) {
      throw apiError(error);
    }
    const revision = await this.revisions.getRevision(input.revisionId);
    if (revision === undefined) {
      throw new ApiRequestError(
        404,
        "REVISION_NOT_FOUND",
        DEPLOYMENT_ERROR_MESSAGES.REVISION_NOT_FOUND,
      );
    }
    const validation = await this.validations.latestCompleted(revision.id);
    const changeSet =
      revision.changeSetId === null
        ? undefined
        : await this.revisions.getById(revision.changeSetId);
    const planId =
      typeof body.plannedMigrationId === "string"
        ? body.plannedMigrationId
        : (changeSet?.migrationPlanId ?? null);
    const plan = planId === null ? undefined : await this.plans.getById(planId);
    try {
      evaluateEligibility({ revision, validation, plan, changeSet });
    } catch (error) {
      throw apiError(error);
    }
    if (validation === undefined || plan === undefined) {
      throw new ApiRequestError(
        400,
        "REVISION_NOT_ELIGIBLE",
        DEPLOYMENT_ERROR_MESSAGES.REVISION_NOT_ELIGIBLE,
      );
    }
    const requestedCandidateId =
      typeof body.deploymentCandidateId === "string" ? body.deploymentCandidateId : undefined;
    let candidateId = requestedCandidateId;
    if (candidateId === undefined) {
      const existing = await this.deployments.listCandidates(revision.id);
      const foundry = existing.filter((item) => item.framework === "FOUNDRY");
      if (foundry.length === 1 && foundry[0] !== undefined) {
        candidateId = foundry[0].id;
      } else if (foundry.length > 1) {
        throw new ApiRequestError(
          400,
          "CANDIDATE_REQUIRED",
          DEPLOYMENT_ERROR_MESSAGES.CANDIDATE_REQUIRED,
        );
      }
    }
    if (candidateId === undefined) {
      candidateId = "pending";
    }
    const digest = await this.images
      .inspectDigest(SANDBOX_IMAGE_TAGS.foundry)
      .catch(() => "unresolved");
    const idempotencyKey = buildDeploymentPrepareKey({
      repositoryRevisionId: revision.id,
      revisionContentHash: revision.contentHash,
      targetTestnetKey: target.key,
      deploymentProfileVersion: DEPLOYMENT_PROFILE_VERSION,
      deploymentEngineVersion: DEPLOYMENT_ENGINE_VERSION,
      deploymentCandidateId: candidateId,
    });
    const existingRun = await this.deployments.findByIdempotencyKey(idempotencyKey);
    if (existingRun !== undefined) {
      if (existingRun.status === "QUEUED" || existingRun.status === "FAILED") {
        if (existingRun.status === "QUEUED") {
          await this.queue.enqueuePrepareDeployment(existingRun.id);
        }
      }
      return { run: existingRun, created: false };
    }
    try {
      const run = await this.deployments.createQueued({
        projectId: revision.projectId,
        repositoryRevisionId: revision.id,
        plannedMigrationId: plan.id,
        changeSetId: changeSet?.id ?? null,
        validationRunId: validation.id,
        deploymentCandidateId: candidateId === "pending" ? null : candidateId,
        targetTestnetKey: target.key,
        targetChainId: target.chainId,
        targetName: target.name,
        revisionContentHash: revision.contentHash,
        engineVersion: DEPLOYMENT_ENGINE_VERSION,
        profile: DEPLOYMENT_PROFILE_ID,
        framework: "FOUNDRY",
        sandboxImage: SANDBOX_IMAGE_TAGS.foundry,
        sandboxImageDigest: digest,
        limitsJson: this.limits,
        networkPolicy: "rpc-proxy-only",
        idempotencyKey,
      });
      await this.queue.enqueuePrepareDeployment(run.id);
      return { run, created: true };
    } catch (error) {
      if (!(error instanceof UniqueConstraintError)) {
        throw error;
      }
      const raced = await this.deployments.findByIdempotencyKey(idempotencyKey);
      if (raced === undefined) {
        throw error;
      }
      return { run: raced, created: false };
    }
  }

  public async confirm(id: string, body: unknown): Promise<DeploymentRunRecord> {
    try {
      rejectArbitraryCommand(body);
    } catch (error) {
      throw apiError(error);
    }
    const record = asRecord(body);
    const run = await this.deployments.getById(id);
    if (run === undefined) {
      throw new ApiRequestError(
        404,
        "DEPLOYMENT_NOT_FOUND",
        DEPLOYMENT_ERROR_MESSAGES.DEPLOYMENT_NOT_FOUND,
      );
    }
    if (
      run.status === "COMPLETED" ||
      run.status === "BROADCASTING" ||
      run.status === "CONFIRMING"
    ) {
      return run;
    }
    if (run.status !== "PREPARED") {
      throw new ApiRequestError(
        409,
        "DEPLOYMENT_NOT_ELIGIBLE",
        "Deployment is not prepared for broadcast",
      );
    }
    const confirmTarget = asString(
      record.confirmTargetKey ?? record.targetTestnetKey,
      "confirmTargetKey",
    );
    if (confirmTarget !== run.targetTestnetKey) {
      throw new ApiRequestError(
        400,
        "CONFIRMATION_MISMATCH",
        DEPLOYMENT_ERROR_MESSAGES.CONFIRMATION_MISMATCH,
      );
    }
    await this.queue.enqueueBroadcastDeployment(run.id);
    return run;
  }

  public async cancel(id: string): Promise<DeploymentRunRecord> {
    const run = await this.deployments.getById(id);
    if (run === undefined) {
      throw new ApiRequestError(
        404,
        "DEPLOYMENT_NOT_FOUND",
        DEPLOYMENT_ERROR_MESSAGES.DEPLOYMENT_NOT_FOUND,
      );
    }
    if (
      run.status === "BROADCASTING" ||
      run.status === "CONFIRMING" ||
      run.status === "VERIFYING" ||
      run.status === "COMPLETED"
    ) {
      throw new ApiRequestError(
        409,
        "BROADCAST_ALREADY_STARTED",
        DEPLOYMENT_ERROR_MESSAGES.BROADCAST_ALREADY_STARTED,
      );
    }
    return this.deployments.transition({
      deploymentId: id,
      fromStatus: run.status,
      toStatus: "CANCELLED",
      reason: "cancelled before broadcast",
    });
  }

  public async reconcile(id: string): Promise<DeploymentRunRecord> {
    const run = await this.deployments.getById(id);
    if (run === undefined) {
      throw new ApiRequestError(
        404,
        "DEPLOYMENT_NOT_FOUND",
        DEPLOYMENT_ERROR_MESSAGES.DEPLOYMENT_NOT_FOUND,
      );
    }
    await this.queue.enqueueReconcileDeployment(run.id);
    return run;
  }
}

function asRecord(body: unknown): Record<string, unknown> {
  if (body === undefined || body === null) {
    return {};
  }
  if (typeof body !== "object" || Array.isArray(body)) {
    throw new ApiRequestError(400, "INVALID_REQUEST", DEPLOYMENT_ERROR_MESSAGES.INVALID_REQUEST);
  }
  return body as Record<string, unknown>;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiRequestError(400, "INVALID_REQUEST", `${field} is required`);
  }
  return value;
}

function apiError(error: unknown): ApiRequestError {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return new ApiRequestError(
      400,
      error.code,
      error instanceof Error ? error.message : error.code,
    );
  }
  return new ApiRequestError(
    400,
    "REVISION_NOT_ELIGIBLE",
    DEPLOYMENT_ERROR_MESSAGES.REVISION_NOT_ELIGIBLE,
  );
}
