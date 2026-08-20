import { presentJob, presentProject, presentRepository } from "../presenters.js";
import type { PublicPartnerService } from "../public-partners-service.js";
import type { ProjectsService } from "../projects-service.js";
import type { ApiInstance } from "../types.js";

export function registerPublicPartnerRoutes(
  app: ApiInstance,
  service: PublicPartnerService,
  projects: ProjectsService,
): void {
  app.get<{ Params: { slug: string } }>("/v1/public/partners/:slug", async (request) => ({
    data: await service.getBySlug(request.params.slug),
  }));

  app.post<{ Params: { slug: string } }>(
    "/v1/public/partners/:slug/projects",
    async (request, reply) => {
      const result = await service.createProject(request.params.slug, request.body);
      const partner = await projects.resolvePartner(result.data.project);
      const statusCode = result.created ? 201 : 200;
      return reply.status(statusCode).send({
        data: {
          project: presentProject(result.data.project, partner),
          repository: presentRepository(result.data.repository),
          job: presentJob(result.data.job),
        },
      });
    },
  );
}
