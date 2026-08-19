import {
  assertValidationTransition,
  createId,
  type JsonObject,
  type ValidationFramework,
  type ValidationOutcome,
  type ValidationProfile,
  type ValidationRunRecord,
  type ValidationRunStatus,
  type ValidationStepName,
  type ValidationStepStatus,
} from "@chainport/shared";

import type { DatabaseClient } from "./client.js";
import { rethrowPersistenceError } from "./client.js";

export class ValidationRepository {
  public constructor(private readonly client: DatabaseClient) {}

  public async findByIdempotencyKey(key: string): Promise<ValidationRunRecord | undefined> {
    const row = await this.client.validationRun.findUnique({ where: { idempotencyKey: key } });
    return row === null ? undefined : mapRun(row);
  }

  public async getById(id: string): Promise<ValidationRunRecord | undefined> {
    const row = await this.client.validationRun.findUnique({ where: { id } });
    return row === null ? undefined : mapRun(row);
  }

  public async listForRevision(repositoryRevisionId: string): Promise<ValidationRunRecord[]> {
    const rows = await this.client.validationRun.findMany({
      where: { repositoryRevisionId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapRun);
  }

  public async latestCompleted(
    repositoryRevisionId: string,
  ): Promise<ValidationRunRecord | undefined> {
    const row = await this.client.validationRun.findFirst({
      where: { repositoryRevisionId, status: { in: ["COMPLETED", "TIMED_OUT"] } },
      orderBy: { completedAt: "desc" },
    });
    return row === null ? undefined : mapRun(row);
  }

  public async createQueued(input: {
    projectId: string;
    repositoryRevisionId: string;
    revisionType: ValidationRunRecord["revisionType"];
    baseCommitSha: string;
    revisionContentHash: string;
    engineVersion: string;
    profile: ValidationProfile;
    sandboxImage: string;
    sandboxImageDigest: string;
    limitsJson: JsonObject;
    networkPolicy: string;
    idempotencyKey: string;
  }): Promise<ValidationRunRecord> {
    try {
      const row = await this.client.$transaction(async (tx) => {
        const created = await tx.validationRun.create({
          data: {
            id: createId(),
            projectId: input.projectId,
            repositoryRevisionId: input.repositoryRevisionId,
            revisionType: input.revisionType,
            baseCommitSha: input.baseCommitSha,
            revisionContentHash: input.revisionContentHash,
            engineVersion: input.engineVersion,
            profile: input.profile,
            sandboxImage: input.sandboxImage,
            sandboxImageDigest: input.sandboxImageDigest,
            limitsJson: input.limitsJson,
            networkPolicy: input.networkPolicy,
            idempotencyKey: input.idempotencyKey,
            status: "QUEUED",
          },
        });
        await tx.validationStatusEvent.create({
          data: {
            id: createId(),
            validationRunId: created.id,
            fromStatus: null,
            toStatus: "QUEUED",
            reason: "validation requested",
          },
        });
        for (const name of [
          "MATERIALIZE",
          "VERIFY_REVISION",
          "INSTALL",
          "BUILD",
          "TEST",
          "CLEANUP",
        ] as const) {
          await tx.validationStep.create({
            data: { id: createId(), validationRunId: created.id, name, status: "PENDING" },
          });
        }
        return created;
      });
      return mapRun(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async transition(input: {
    validationId: string;
    fromStatus: ValidationRunStatus;
    toStatus: ValidationRunStatus;
    reason: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    outcome?: ValidationOutcome | null;
    framework?: ValidationFramework | null;
    runtimeVersion?: string | null;
    buildStatus?: ValidationStepStatus | null;
    testStatus?: ValidationStepStatus | null;
    durationMs?: number | null;
  }): Promise<ValidationRunRecord> {
    assertValidationTransition(input.fromStatus, input.toStatus);
    const now = new Date();
    try {
      const row = await this.client.$transaction(async (tx) => {
        const updated = await tx.validationRun.update({
          where: { id: input.validationId },
          data: {
            status: input.toStatus,
            ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
            ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
            ...(input.outcome !== undefined ? { outcome: input.outcome } : {}),
            ...(input.framework !== undefined ? { framework: input.framework } : {}),
            ...(input.runtimeVersion !== undefined ? { runtimeVersion: input.runtimeVersion } : {}),
            ...(input.buildStatus !== undefined ? { buildStatus: input.buildStatus } : {}),
            ...(input.testStatus !== undefined ? { testStatus: input.testStatus } : {}),
            ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
            ...(input.toStatus === "PREPARING" && input.fromStatus === "QUEUED"
              ? { startedAt: now }
              : {}),
            ...(input.toStatus === "COMPLETED" ||
            input.toStatus === "FAILED" ||
            input.toStatus === "TIMED_OUT"
              ? { completedAt: now }
              : {}),
          },
        });
        await tx.validationStatusEvent.create({
          data: {
            id: createId(),
            validationRunId: input.validationId,
            fromStatus: input.fromStatus,
            toStatus: input.toStatus,
            reason: input.reason,
          },
        });
        return updated;
      });
      return mapRun(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async setSandbox(validationId: string, image: string, digest: string): Promise<void> {
    await this.client.validationRun.update({
      where: { id: validationId },
      data: { sandboxImage: image, sandboxImageDigest: digest },
    });
  }

  public async updateStep(input: {
    validationId: string;
    name: ValidationStepName;
    status: ValidationStepStatus;
    exitCode?: number | null;
    durationMs?: number | null;
    logText?: string | null;
    logTruncated?: boolean;
    errorCode?: string | null;
  }): Promise<void> {
    const now = new Date();
    await this.client.validationStep.updateMany({
      where: { validationRunId: input.validationId, name: input.name },
      data: {
        status: input.status,
        ...(input.exitCode !== undefined ? { exitCode: input.exitCode } : {}),
        ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
        ...(input.logText !== undefined ? { logText: input.logText } : {}),
        ...(input.logTruncated !== undefined ? { logTruncated: input.logTruncated } : {}),
        ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
        ...(input.status === "RUNNING" ? { startedAt: now } : {}),
        ...(input.status === "PASSED" ||
        input.status === "FAILED" ||
        input.status === "SKIPPED" ||
        input.status === "TIMED_OUT"
          ? { completedAt: now }
          : {}),
      },
    });
  }

  public async persistTestCounts(input: {
    validationId: string;
    countsAvailable: boolean;
    total: number | null;
    passed: number | null;
    failed: number | null;
    skipped: number | null;
    cases: Array<{
      suite: string | null;
      testName: string;
      status: string;
      failureSummary: string | null;
    }>;
  }): Promise<void> {
    await this.client.validationRun.update({
      where: { id: input.validationId },
      data: {
        countsAvailable: input.countsAvailable,
        testTotal: input.total,
        testPassed: input.passed,
        testFailed: input.failed,
        testSkipped: input.skipped,
      },
    });
    if (input.cases.length === 0) {
      return;
    }
    await this.client.validationTestResult.createMany({
      data: input.cases.slice(0, 200).map((item) => ({
        id: createId(),
        validationRunId: input.validationId,
        suite: item.suite,
        testName: item.testName,
        status: item.status,
        failureSummary: item.failureSummary,
      })),
    });
  }

  public async getDetails(id: string) {
    return this.client.validationRun.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { name: "asc" } },
        tests: { orderBy: { testName: "asc" } },
        events: { orderBy: { createdAt: "asc" } },
        repositoryRevision: true,
      },
    });
  }
}

function mapRun(row: {
  id: string;
  projectId: string;
  repositoryRevisionId: string;
  revisionType: ValidationRunRecord["revisionType"];
  baseCommitSha: string;
  revisionContentHash: string;
  engineVersion: string;
  profile: ValidationRunRecord["profile"];
  framework: ValidationRunRecord["framework"];
  status: ValidationRunRecord["status"];
  outcome: ValidationRunRecord["outcome"];
  sandboxImage: string | null;
  sandboxImageDigest: string | null;
  runtimeVersion: string | null;
  buildStatus: ValidationRunRecord["buildStatus"];
  testStatus: ValidationRunRecord["testStatus"];
  countsAvailable: boolean;
  testTotal: number | null;
  testPassed: number | null;
  testFailed: number | null;
  testSkipped: number | null;
  durationMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  idempotencyKey: string;
  limitsJson: unknown;
  networkPolicy: string;
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ValidationRunRecord {
  return {
    ...row,
    limitsJson:
      typeof row.limitsJson === "object" &&
      row.limitsJson !== null &&
      !Array.isArray(row.limitsJson)
        ? (row.limitsJson as JsonObject)
        : {},
  };
}
