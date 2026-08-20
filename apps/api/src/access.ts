import {
  canAccessProject,
  canCreatePlatformPartner,
  canManagePartner,
  canViewPartner,
  type Actor,
} from "@chainport/auth";
import type { IngestRepository, PartnerRepository } from "@chainport/db";
import type { NetworkPartner, Project } from "@chainport/shared";

import { ApiRequestError } from "./errors.js";

export class AccessControl {
  public constructor(
    private readonly ingest: IngestRepository,
    private readonly partners: PartnerRepository,
  ) {}

  public requireUser(actor: Actor | undefined): Actor {
    if (actor === undefined) {
      throw new ApiRequestError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
    }
    return actor;
  }

  public async requireProject(actor: Actor | undefined, projectId: string): Promise<Project> {
    const user = this.requireUser(actor);
    const project = await this.ingest.getProjectById(projectId);
    if (project === undefined || !canAccessProject(user, project)) {
      throw new ApiRequestError(404, "PROJECT_NOT_FOUND", "Project not found");
    }
    return project;
  }

  public async requirePartnerView(
    actor: Actor | undefined,
    partnerId: string,
  ): Promise<NetworkPartner> {
    const user = this.requireUser(actor);
    const partner = await this.partners.getById(partnerId);
    if (partner === undefined || !canViewPartner(user, partner.organizationId)) {
      throw new ApiRequestError(404, "PARTNER_NOT_FOUND", "Network partner not found");
    }
    return partner;
  }

  public async requirePartnerManage(
    actor: Actor | undefined,
    partnerId: string,
  ): Promise<NetworkPartner> {
    const user = this.requireUser(actor);
    const partner = await this.partners.getById(partnerId);
    if (partner === undefined || !canManagePartner(user, partner.organizationId)) {
      throw new ApiRequestError(404, "PARTNER_NOT_FOUND", "Network partner not found");
    }
    return partner;
  }

  public requirePlatformAdmin(actor: Actor | undefined): Actor {
    const user = this.requireUser(actor);
    if (!canCreatePlatformPartner(user)) {
      throw new ApiRequestError(403, "FORBIDDEN", "You do not have permission to this resource");
    }
    return user;
  }
}
