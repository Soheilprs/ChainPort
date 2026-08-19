import {
  UniqueConstraintError,
  type ChangeSetRepository,
  type ValidationRepository,
} from "@chainport/db";
import { SANDBOX_IMAGE_TAGS } from "@chainport/sandbox";
import {
  buildValidationIdempotencyKey,
  VALIDATION_ENGINE_VERSION,
  VALIDATION_ERROR_MESSAGES,
  VALIDATION_PROFILE_ID,
  type JsonObject,
  type ValidationRunRecord,
} from "@chainport/shared";

import { ApiRequestError } from "./errors.js";
import type { JobQueue } from "./queue.js";

export interface ImageDigestResolver {
  inspectDigest(image: string): Promise<string>;
}

export class ValidationService {
  public constructor(
    private readonly revisions: ChangeSetRepository,
    private readonly validations: ValidationRepository,
    private readonly queue: JobQueue,
    private readonly images: ImageDigestResolver,
    private readonly imageOverrides: { foundry?: string; node20?: string; node22?: string } = {},
    private readonly limits: JsonObject,
  ) {}

  public async createForRevision(
    revisionId: string,
  ): Promise<{ run: ValidationRunRecord; created: boolean }> {
    const revision = await this.revisions.getRevision(revisionId);
    if (revision === undefined) {
      throw new ApiRequestError(
        404,
        "REVISION_NOT_FOUND",
        VALIDATION_ERROR_MESSAGES.REVISION_NOT_FOUND,
      );
    }
    const foundry = this.imageOverrides.foundry ?? SANDBOX_IMAGE_TAGS.foundry;
    const digest = await this.images.inspectDigest(foundry);
    const idempotencyKey = buildValidationIdempotencyKey({
      repositoryRevisionId: revision.id,
      revisionContentHash: revision.contentHash,
      engineVersion: VALIDATION_ENGINE_VERSION,
      sandboxImageDigest: digest,
      profile: VALIDATION_PROFILE_ID,
    });
    const existing = await this.validations.findByIdempotencyKey(idempotencyKey);
    if (existing !== undefined) {
      if (existing.status === "QUEUED" || existing.status === "FAILED") {
        await this.queue.enqueueValidate(existing.id);
      }
      return { run: existing, created: false };
    }
    try {
      const run = await this.validations.createQueued({
        projectId: revision.projectId,
        repositoryRevisionId: revision.id,
        revisionType: revision.type,
        baseCommitSha: revision.baseCommitSha,
        revisionContentHash: revision.contentHash,
        engineVersion: VALIDATION_ENGINE_VERSION,
        profile: VALIDATION_PROFILE_ID,
        sandboxImage: foundry,
        sandboxImageDigest: digest,
        limitsJson: this.limits,
        networkPolicy: "install-then-none",
        idempotencyKey,
      });
      await this.queue.enqueueValidate(run.id);
      return { run, created: true };
    } catch (error) {
      if (!(error instanceof UniqueConstraintError)) {
        throw error;
      }
      const raced = await this.validations.findByIdempotencyKey(idempotencyKey);
      if (raced === undefined) {
        throw error;
      }
      return { run: raced, created: false };
    }
  }

  public async listForRevision(revisionId: string) {
    const revision = await this.revisions.getRevision(revisionId);
    if (revision === undefined) {
      throw new ApiRequestError(
        404,
        "REVISION_NOT_FOUND",
        VALIDATION_ERROR_MESSAGES.REVISION_NOT_FOUND,
      );
    }
    return this.validations.listForRevision(revisionId);
  }

  public async get(id: string) {
    const details = await this.validations.getDetails(id);
    if (details === null) {
      throw new ApiRequestError(
        404,
        "VALIDATION_NOT_FOUND",
        VALIDATION_ERROR_MESSAGES.VALIDATION_NOT_FOUND,
      );
    }
    return details;
  }

  public async compare(revisionId: string) {
    const revision = await this.revisions.getRevision(revisionId);
    if (revision === undefined) {
      throw new ApiRequestError(
        404,
        "REVISION_NOT_FOUND",
        VALIDATION_ERROR_MESSAGES.REVISION_NOT_FOUND,
      );
    }
    const original =
      revision.type === "GENERATED" && revision.baseRevisionId !== null
        ? await this.validations.latestCompleted(revision.baseRevisionId)
        : await this.validations.latestCompleted(revision.id);
    const generated =
      revision.type === "GENERATED"
        ? await this.validations.latestCompleted(revision.id)
        : undefined;
    return { revision, original: original ?? null, generated: generated ?? null };
  }
}
