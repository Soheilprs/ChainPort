import {
  createId,
  parsePartnerBranding,
  slugFromNetworkKey,
  type NetworkPartner,
  type NetworkPartnerStatus,
  type OrganizationKind,
} from "@chainport/shared";

import type { DatabaseClient } from "./client.js";
import { rethrowPersistenceError } from "./client.js";
import { mapPartner } from "./mappers.js";

export interface CreatePartnerInput {
  organizationId?: string;
  organizationName?: string;
  organizationKind?: OrganizationKind;
  networkKey: string;
  slug?: string;
  displayName: string;
  status?: NetworkPartnerStatus;
  isDemo?: boolean;
  logoUrl?: string | null;
  primaryAccent?: string | null;
  shortDescription?: string | null;
  developerPortalEnabled?: boolean;
  docsUrl?: string | null;
  faucetUrl?: string | null;
  explorerUrl?: string | null;
  supportUrl?: string | null;
  discordUrl?: string | null;
  developerDocsUrl?: string | null;
}

export interface UpdatePartnerInput {
  slug?: string;
  displayName?: string;
  status?: NetworkPartnerStatus;
  logoUrl?: string | null;
  primaryAccent?: string | null;
  shortDescription?: string | null;
  developerPortalEnabled?: boolean;
  docsUrl?: string | null;
  faucetUrl?: string | null;
  explorerUrl?: string | null;
  supportUrl?: string | null;
  discordUrl?: string | null;
  developerDocsUrl?: string | null;
}

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

  public async getBySlug(slug: string): Promise<NetworkPartner | undefined> {
    const row = await this.client.networkPartner.findUnique({ where: { slug } });
    return row === null ? undefined : mapPartner(row);
  }

  public async create(input: CreatePartnerInput): Promise<NetworkPartner> {
    const branding = parsePartnerBranding({
      displayName: input.displayName,
      ...(input.slug === undefined ? {} : { slug: input.slug }),
      ...(input.logoUrl === undefined ? {} : { logoUrl: input.logoUrl }),
      ...(input.primaryAccent === undefined ? {} : { primaryAccent: input.primaryAccent }),
      ...(input.shortDescription === undefined ? {} : { shortDescription: input.shortDescription }),
      ...(input.docsUrl === undefined ? {} : { docsUrl: input.docsUrl }),
      ...(input.faucetUrl === undefined ? {} : { faucetUrl: input.faucetUrl }),
      ...(input.explorerUrl === undefined ? {} : { explorerUrl: input.explorerUrl }),
      ...(input.supportUrl === undefined ? {} : { supportUrl: input.supportUrl }),
      ...(input.discordUrl === undefined ? {} : { discordUrl: input.discordUrl }),
      ...(input.developerDocsUrl === undefined ? {} : { developerDocsUrl: input.developerDocsUrl }),
    });
    try {
      let organizationId = input.organizationId;
      if (organizationId === undefined) {
        const name = input.organizationName ?? input.displayName;
        const org = await this.client.organization.create({
          data: {
            id: createId(),
            name,
            slug: organizationSlug(name),
            kind: input.organizationKind ?? "NETWORK",
          },
        });
        organizationId = org.id;
      }
      const slug = branding.slug ?? (await this.allocateSlug(slugFromNetworkKey(input.networkKey)));
      const row = await this.client.networkPartner.create({
        data: {
          id: createId(),
          organizationId,
          networkKey: input.networkKey,
          slug,
          displayName: branding.displayName ?? input.displayName,
          status: input.status ?? "ACTIVE",
          isDemo: input.isDemo ?? false,
          logoUrl: branding.logoUrl,
          primaryAccent: branding.primaryAccent,
          shortDescription: branding.shortDescription,
          developerPortalEnabled: input.developerPortalEnabled ?? true,
          docsUrl: branding.docsUrl,
          faucetUrl: branding.faucetUrl,
          explorerUrl: branding.explorerUrl,
          supportUrl: branding.supportUrl,
          discordUrl: branding.discordUrl,
          developerDocsUrl: branding.developerDocsUrl,
        },
      });
      return mapPartner(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  public async update(id: string, input: UpdatePartnerInput): Promise<NetworkPartner> {
    const branding = parsePartnerBranding({
      ...(input.slug === undefined ? {} : { slug: input.slug }),
      ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
      ...(input.logoUrl === undefined ? {} : { logoUrl: input.logoUrl }),
      ...(input.primaryAccent === undefined ? {} : { primaryAccent: input.primaryAccent }),
      ...(input.shortDescription === undefined ? {} : { shortDescription: input.shortDescription }),
      ...(input.docsUrl === undefined ? {} : { docsUrl: input.docsUrl }),
      ...(input.faucetUrl === undefined ? {} : { faucetUrl: input.faucetUrl }),
      ...(input.explorerUrl === undefined ? {} : { explorerUrl: input.explorerUrl }),
      ...(input.supportUrl === undefined ? {} : { supportUrl: input.supportUrl }),
      ...(input.discordUrl === undefined ? {} : { discordUrl: input.discordUrl }),
      ...(input.developerDocsUrl === undefined ? {} : { developerDocsUrl: input.developerDocsUrl }),
    });
    try {
      const row = await this.client.networkPartner.update({
        where: { id },
        data: {
          ...(branding.slug === undefined ? {} : { slug: branding.slug }),
          ...(branding.displayName === undefined ? {} : { displayName: branding.displayName }),
          ...(input.status === undefined ? {} : { status: input.status }),
          ...(input.developerPortalEnabled === undefined
            ? {}
            : { developerPortalEnabled: input.developerPortalEnabled }),
          ...(input.logoUrl === undefined ? {} : { logoUrl: branding.logoUrl }),
          ...(input.primaryAccent === undefined ? {} : { primaryAccent: branding.primaryAccent }),
          ...(input.shortDescription === undefined
            ? {}
            : { shortDescription: branding.shortDescription }),
          ...(input.docsUrl === undefined ? {} : { docsUrl: branding.docsUrl }),
          ...(input.faucetUrl === undefined ? {} : { faucetUrl: branding.faucetUrl }),
          ...(input.explorerUrl === undefined ? {} : { explorerUrl: branding.explorerUrl }),
          ...(input.supportUrl === undefined ? {} : { supportUrl: branding.supportUrl }),
          ...(input.discordUrl === undefined ? {} : { discordUrl: branding.discordUrl }),
          ...(input.developerDocsUrl === undefined
            ? {}
            : { developerDocsUrl: branding.developerDocsUrl }),
        },
      });
      return mapPartner(row);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  private async allocateSlug(preferred: string): Promise<string> {
    const existing = await this.client.networkPartner.findUnique({ where: { slug: preferred } });
    if (existing === null) {
      return preferred;
    }
    return `${preferred}-${createId().replaceAll("-", "").slice(0, 8)}`;
  }
}

function organizationSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug.length > 0 ? `${slug}-${createId().slice(0, 8)}` : createId();
}
