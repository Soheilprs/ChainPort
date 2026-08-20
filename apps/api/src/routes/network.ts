import { presentNetworkPartner } from "../presenters.js";
import type { NetworkService } from "../network-service.js";
import type { AccessControl } from "../access.js";
import type { ApiInstance } from "../types.js";

export function registerNetworkRoutes(
  app: ApiInstance,
  service: NetworkService,
  access?: AccessControl,
): void {
  app.get("/v1/network-partners", async (request) => {
    const partners = await service.list();
    const visible =
      access === undefined || request.actor?.isPlatformAdmin === true
        ? partners
        : partners.filter((partner) =>
            request.actor?.memberships.some(
              (item) => item.organizationId === partner.organizationId,
            ),
          );
    return { data: visible.map(presentNetworkPartner) };
  });

  app.post("/v1/network-partners", async (request, reply) => {
    if (access !== undefined) {
      access.requirePlatformAdmin(request.actor);
    }
    const partner = await service.create(request.body);
    return reply.status(201).send({ data: presentNetworkPartner(partner) });
  });

  app.get<{ Params: { id: string } }>("/v1/network-partners/:id", async (request) => {
    if (access !== undefined) {
      await access.requirePartnerView(request.actor, request.params.id);
    }
    return { data: presentNetworkPartner(await service.get(request.params.id)) };
  });

  app.patch<{ Params: { id: string } }>("/v1/network-partners/:id", async (request) => {
    if (access !== undefined) {
      await access.requirePartnerManage(request.actor, request.params.id);
    }
    return { data: presentNetworkPartner(await service.update(request.params.id, request.body)) };
  });

  app.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/v1/network-partners/:id/overview",
    async (request) => {
      if (access !== undefined) {
        await access.requirePartnerView(request.actor, request.params.id);
      }
      return { data: await service.overview(request.params.id, request.query) };
    },
  );

  app.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/v1/network-partners/:id/funnel",
    async (request) => {
      if (access !== undefined) {
        await access.requirePartnerView(request.actor, request.params.id);
      }
      return { data: await service.funnel(request.params.id, request.query) };
    },
  );

  app.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/v1/network-partners/:id/projects",
    async (request) => {
      if (access !== undefined) {
        await access.requirePartnerView(request.actor, request.params.id);
      }
      return { data: await service.projects(request.params.id, request.query) };
    },
  );

  app.get<{ Params: { id: string; projectId: string }; Querystring: Record<string, unknown> }>(
    "/v1/network-partners/:id/projects/:projectId",
    async (request) => {
      if (access !== undefined) {
        await access.requirePartnerView(request.actor, request.params.id);
      }
      return {
        data: await service.project(request.params.id, request.params.projectId, request.query),
      };
    },
  );

  app.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/v1/network-partners/:id/blockers",
    async (request) => {
      if (access !== undefined) {
        await access.requirePartnerView(request.actor, request.params.id);
      }
      return { data: await service.blockers(request.params.id, request.query) };
    },
  );

  app.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/v1/network-partners/:id/infrastructure-gaps",
    async (request) => {
      if (access !== undefined) {
        await access.requirePartnerView(request.actor, request.params.id);
      }
      return { data: await service.gaps(request.params.id, request.query) };
    },
  );

  app.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/v1/network-partners/:id/migrations",
    async (request) => {
      if (access !== undefined) {
        await access.requirePartnerView(request.actor, request.params.id);
      }
      return { data: await service.migrations(request.params.id, request.query) };
    },
  );

  app.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/v1/network-partners/:id/validations",
    async (request) => {
      if (access !== undefined) {
        await access.requirePartnerView(request.actor, request.params.id);
      }
      return { data: await service.validations(request.params.id, request.query) };
    },
  );

  app.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/v1/network-partners/:id/deployments",
    async (request) => {
      if (access !== undefined) {
        await access.requirePartnerView(request.actor, request.params.id);
      }
      return { data: await service.deployments(request.params.id, request.query) };
    },
  );

  app.get<{ Params: { id: string } }>("/v1/network-partners/:id/registry", async (request) => {
    if (access !== undefined) {
      await access.requirePartnerView(request.actor, request.params.id);
    }
    return { data: await service.registry(request.params.id) };
  });

  app.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/v1/network-partners/:id/insights",
    async (request) => {
      if (access !== undefined) {
        await access.requirePartnerView(request.actor, request.params.id);
      }
      return { data: await service.insights(request.params.id, request.query) };
    },
  );
}
