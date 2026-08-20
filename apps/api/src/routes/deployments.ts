import type { DeploymentRunRecord } from "@chainport/shared";

import type { DeploymentService } from "../deployment-service.js";
import type { AccessControl } from "../access.js";
import type { ApiInstance } from "../types.js";
import { ApiRequestError } from "../errors.js";
import type { ServiceConfig } from "@chainport/shared";

export function registerDeploymentRoutes(
  app: ApiInstance,
  service: DeploymentService,
  access?: AccessControl,
  config?: ServiceConfig,
): void {
  app.get("/v1/deployment-targets", () => ({ data: service.listTargets() }));

  app.get<{ Params: { key: string } }>("/v1/chains/:key/deployment-target", (request) => ({
    data: service.getTarget(request.params.key),
  }));

  app.get<{ Params: { id: string } }>(
    "/v1/revisions/:id/deployment-candidates",
    async (request) => {
      const candidates = await service.listCandidates(request.params.id);
      return { data: candidates };
    },
  );

  app.get<{ Params: { id: string } }>("/v1/revisions/:id/deployments", async (request) => {
    const runs = await service.listForRevision(request.params.id);
    return { data: runs.map(presentRun) };
  });

  app.get<{ Params: { id: string } }>("/v1/projects/:id/deployments", async (request) => {
    if (access !== undefined) {
      await access.requireProject(request.actor, request.params.id);
    }
    const runs = await service.listForProject(request.params.id);
    return { data: runs.map(presentRun) };
  });

  app.post<{ Params: { id: string } }>("/v1/revisions/:id/deployments", async (request, reply) => {
    if (config?.ENABLE_TESTNET_DEPLOYMENT === false) {
      throw new ApiRequestError(
        503,
        "DEPLOYMENT_DISABLED",
        "Testnet deployment is temporarily disabled",
      );
    }
    const result = await service.prepare({
      revisionId: request.params.id,
      body: request.body,
    });
    return reply.status(result.created ? 201 : 200).send({ data: presentRun(result.run) });
  });

  app.get<{ Params: { id: string } }>("/v1/deployments/:id", async (request) => {
    const details = await service.get(request.params.id);
    if (access !== undefined) {
      await access.requireProject(request.actor, details.projectId);
    }
    return {
      data: {
        run: presentRun(details),
        candidate: details.deploymentCandidate,
        preflight: details.preflight,
        transactions: details.transactions.map((tx) => ({
          id: tx.id,
          sequence: tx.sequence,
          hash: tx.hash,
          nonce: tx.nonce,
          from: tx.fromAddress,
          to: tx.toAddress,
          value: tx.value,
          gasLimit: tx.gasLimit,
          status: tx.status,
          blockNumber: tx.blockNumber,
          contractAddress: tx.contractAddress,
          createdAt: tx.createdAt.toISOString(),
          confirmedAt: tx.confirmedAt?.toISOString() ?? null,
        })),
        contracts: details.contracts,
        checks: details.checks,
        events: details.events.map((event) => ({
          id: event.id,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          reason: event.reason,
          createdAt: event.createdAt.toISOString(),
        })),
        revision: {
          id: details.repositoryRevision.id,
          type: details.repositoryRevision.type,
          contentHash: details.repositoryRevision.contentHash,
        },
      },
    };
  });

  app.post<{ Params: { id: string } }>("/v1/deployments/:id/confirm", async (request) => {
    const run = await service.confirm(request.params.id, request.body);
    return { data: presentRun(run) };
  });

  app.post<{ Params: { id: string } }>("/v1/deployments/:id/cancel", async (request) => {
    const run = await service.cancel(request.params.id);
    return { data: presentRun(run) };
  });

  app.post<{ Params: { id: string } }>("/v1/deployments/:id/reconcile", async (request) => {
    const run = await service.reconcile(request.params.id);
    return { data: presentRun(run) };
  });
}

function presentRun(run: DeploymentRunRecord | Record<string, unknown>) {
  const row = run as DeploymentRunRecord;
  return {
    id: row.id,
    projectId: row.projectId,
    repositoryRevisionId: row.repositoryRevisionId,
    plannedMigrationId: row.plannedMigrationId,
    validationRunId: row.validationRunId,
    deploymentCandidateId: row.deploymentCandidateId,
    targetTestnetKey: row.targetTestnetKey,
    targetChainId: row.targetChainId,
    targetName: row.targetName,
    revisionContentHash: row.revisionContentHash,
    engineVersion: row.engineVersion,
    profile: row.profile,
    framework: row.framework,
    status: row.status,
    deployerAddress: row.deployerAddress,
    transactionCount: row.transactionCount,
    estimatedGas: row.estimatedGas,
    estimatedCost: row.estimatedCost,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    networkPolicy: row.networkPolicy,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    startedAt:
      row.startedAt instanceof Date ? row.startedAt.toISOString() : (row.startedAt ?? null),
    completedAt:
      row.completedAt instanceof Date ? row.completedAt.toISOString() : (row.completedAt ?? null),
    broadcastStartedAt:
      row.broadcastStartedAt instanceof Date
        ? row.broadcastStartedAt.toISOString()
        : (row.broadcastStartedAt ?? null),
  };
}
