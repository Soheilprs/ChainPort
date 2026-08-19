import { presentEvent, presentJob, presentProject, presentRepository } from "../presenters.js";
import type { ProjectsService } from "../projects-service.js";
import type { ApiInstance } from "../types.js";

export function registerJobRoutes(app: ApiInstance, service: ProjectsService): void {
  app.get<{ Params: { id: string } }>("/v1/jobs/:id", async (request) => {
    const result = await service.getJob(request.params.id);
    return {
      data: {
        job: presentJob(result.job),
        project: presentProject(result.project),
        repository: presentRepository(result.repository),
        events: result.events.map(presentEvent),
      },
    };
  });
}
