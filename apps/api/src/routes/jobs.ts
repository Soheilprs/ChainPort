import { presentEvent, presentJob, presentProject, presentRepository } from "../presenters.js";
import type { ProjectsService } from "../projects-service.js";
import type { ApiInstance } from "../types.js";

export function registerJobRoutes(app: ApiInstance, service: ProjectsService): void {
  app.get<{ Params: { id: string } }>("/v1/jobs/:id", async (request) => {
    const result = await service.getJob(request.params.id);
    const partner = await service.resolvePartner(result.project);
    return {
      data: {
        job: presentJob(result.job),
        project: presentProject(result.project, partner),
        repository: presentRepository(result.repository),
        events: result.events.map(presentEvent),
      },
    };
  });
}
