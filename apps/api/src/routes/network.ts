import { presentNetworkPartner } from "../presenters.js";
import type { NetworkService } from "../network-service.js";
import type { ApiInstance } from "../types.js";

export function registerNetworkRoutes(app: ApiInstance, service: NetworkService): void {
  app.get("/v1/network-partners", async () => ({
    data: (await service.list()).map(presentNetworkPartner),
  }));

  app.post("/v1/network-partners", async (request, reply) => {
    const partner = await service.create(request.body);
    return reply.status(201).send({ data: presentNetworkPartner(partner) });
  });

  app.get<{ Params: { id: string } }>("/v1/network-partners/:id", async (request) => ({
    data: presentNetworkPartner(await service.get(request.params.id)),
  }));

  app.patch<{ Params: { id: string } }>("/v1/network-partners/:id", async (request) => ({
    data: presentNetworkPartner(await service.update(request.params.id, request.body)),
  }));

  app.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/v1/network-partners/:id/overview",
    async (request) => ({
      data: await service.overview(request.params.id, request.query),
    }),
  );

  app.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/v1/network-partners/:id/funnel",
    async (request) => ({
      data: await service.funnel(request.params.id, request.query),
    }),
  );

  app.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/v1/network-partners/:id/projects",
    async (request) => ({
      data: await service.projects(request.params.id, request.query),
    }),
  );

  app.get<{ Params: { id: string; projectId: string }; Querystring: Record<string, unknown> }>(
    "/v1/network-partners/:id/projects/:projectId",
    async (request) => ({
      data: await service.project(request.params.id, request.params.projectId, request.query),
    }),
  );

  app.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/v1/network-partners/:id/blockers",
    async (request) => ({
      data: await service.blockers(request.params.id, request.query),
    }),
  );

  app.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/v1/network-partners/:id/infrastructure-gaps",
    async (request) => ({
      data: await service.gaps(request.params.id, request.query),
    }),
  );

  app.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/v1/network-partners/:id/migrations",
    async (request) => ({
      data: await service.migrations(request.params.id, request.query),
    }),
  );

  app.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/v1/network-partners/:id/validations",
    async (request) => ({
      data: await service.validations(request.params.id, request.query),
    }),
  );

  app.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/v1/network-partners/:id/deployments",
    async (request) => ({
      data: await service.deployments(request.params.id, request.query),
    }),
  );

  app.get<{ Params: { id: string } }>("/v1/network-partners/:id/registry", async (request) => ({
    data: await service.registry(request.params.id),
  }));

  app.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/v1/network-partners/:id/insights",
    async (request) => ({
      data: await service.insights(request.params.id, request.query),
    }),
  );
}
