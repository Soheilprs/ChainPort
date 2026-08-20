import {
  createId,
  type NetworkPartner,
  type NetworkPartnerStatus,
  type OrganizationKind,
} from "@chainport/shared";

import type { DatabaseClient } from "./client.js";
import { rethrowPersistenceError } from "./client.js";

export class PartnerRepository {
  public constructor(private readonly client: DatabaseClient) {}

  public async list(): Promise<NetworkPartner[]> {
    const rows = await this.client.networkPartner.findMany({ orderBy: { displayName: "asc" } });
    return rows.map(mapPartner);
  }

  public async getById(id: string): Promise<NetworkPartner | undefined> {
    const row = await this.client.networkPartner.findUnique({ where: { id } });
    return row === null ? undefined : mapPartner(row);
  }

  public async create(input: {
    organizationId?: string;
    organizationName?: string;
    organizationKind?: OrganizationKind;
    networkKey: string;
    displayName: string;
    status?: NetworkPartnerStatus;
    isDemo?: boolean;
  }): Promise<NetworkPartner> {
    try {
      let organizationId = input.organizationId;
      if (organizationId === undefined) {
        const name = input.organizationName ?? input.displayName;
        const slug = slugify(name);
        const org = await this.client.organization.create({
          data: {
            id: createId(),
            name,
            slug,
            kind: input.organizationKind ?? "NETWORK",
          },
        });
        organizationId = org.id;
      }
      const row = await this.client.networkPartner.create({
        data: {
          id: createId(),
          organizationId,
          networkKey: input.networkKey,
          displayName: input.displayName,
          status: input.status ?? "ACTIVE",
          isDemo: input.isDemo ?? false,
        },
      });
      return mapPartner(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }
}

function mapPartner(row: {
  id: string;
  organizationId: string;
  networkKey: string;
  displayName: string;
  status: NetworkPartnerStatus;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
}): NetworkPartner {
  return row;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug.length > 0 ? `${slug}-${createId().slice(0, 8)}` : createId();
}
