import { asJsonObject } from "@chainport/db";
import { compareValidations } from "@chainport/validation";
import type { ValidationRunRecord } from "@chainport/shared";

import type { ValidationService } from "../validation-service.js";
import type { ApiInstance } from "../types.js";

export function registerValidationRoutes(app: ApiInstance, service: ValidationService): void {
  app.post<{ Params: { id: string } }>("/v1/revisions/:id/validations", async (request, reply) => {
    const result = await service.createForRevision(request.params.id);
    return reply.status(result.created ? 201 : 200).send({ data: presentRun(result.run) });
  });

  app.get<{ Params: { id: string } }>("/v1/revisions/:id/validations", async (request) => {
    const runs = await service.listForRevision(request.params.id);
    return { data: runs.map(presentRun) };
  });

  app.get<{ Params: { id: string } }>(
    "/v1/revisions/:id/validation-comparison",
    async (request) => {
      const compared = await service.compare(request.params.id);
      const result = compareValidations(compared.original, compared.generated);
      return {
        data: {
          revision: {
            id: compared.revision.id,
            type: compared.revision.type,
            contentHash: compared.revision.contentHash,
          },
          original: compared.original === null ? null : presentRun(compared.original),
          generated: compared.generated === null ? null : presentRun(compared.generated),
          regressionStatus: result.regressionStatus,
          summary: result.summary,
        },
      };
    },
  );

  app.get<{ Params: { id: string } }>("/v1/validations/:id", async (request) => {
    const details = await service.get(request.params.id);
    return {
      data: {
        run: presentRun({ ...details, limitsJson: asJsonObject(details.limitsJson) }),
        revision: {
          id: details.repositoryRevision.id,
          type: details.repositoryRevision.type,
          baseCommitSha: details.repositoryRevision.baseCommitSha,
          contentHash: details.repositoryRevision.contentHash,
        },
        steps: details.steps.map((step) => ({
          id: step.id,
          name: step.name,
          status: step.status,
          exitCode: step.exitCode,
          durationMs: step.durationMs,
          logTruncated: step.logTruncated,
          errorCode: step.errorCode,
          startedAt: step.startedAt?.toISOString() ?? null,
          completedAt: step.completedAt?.toISOString() ?? null,
        })),
        tests: details.tests.map((test) => ({
          id: test.id,
          suite: test.suite,
          testName: test.testName,
          status: test.status,
          failureSummary: test.failureSummary,
        })),
        events: details.events.map((event) => ({
          id: event.id,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          reason: event.reason,
          createdAt: event.createdAt.toISOString(),
        })),
      },
    };
  });

  app.get<{ Params: { id: string } }>("/v1/validations/:id/steps", async (request) => {
    const details = await service.get(request.params.id);
    return { data: details.steps };
  });

  app.get<{ Params: { id: string } }>("/v1/validations/:id/logs", async (request) => {
    const details = await service.get(request.params.id);
    return {
      data: details.steps.map((step) => ({
        name: step.name,
        status: step.status,
        truncated: step.logTruncated,
        text: step.logText,
      })),
    };
  });
}

function presentRun(run: ValidationRunRecord) {
  return {
    id: run.id,
    projectId: run.projectId,
    repositoryRevisionId: run.repositoryRevisionId,
    revisionType: run.revisionType,
    baseCommitSha: run.baseCommitSha,
    revisionContentHash: run.revisionContentHash,
    engineVersion: run.engineVersion,
    profile: run.profile,
    framework: run.framework,
    status: run.status,
    outcome: run.outcome,
    sandboxImage: run.sandboxImage,
    sandboxImageDigest: run.sandboxImageDigest,
    runtimeVersion: run.runtimeVersion,
    buildStatus: run.buildStatus,
    testStatus: run.testStatus,
    countsAvailable: run.countsAvailable,
    testTotal: run.testTotal,
    testPassed: run.testPassed,
    testFailed: run.testFailed,
    testSkipped: run.testSkipped,
    durationMs: run.durationMs,
    errorCode: run.errorCode,
    errorMessage: run.errorMessage,
    networkPolicy: run.networkPolicy,
    limits: run.limitsJson,
    createdAt: run.createdAt.toISOString(),
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
  };
}
