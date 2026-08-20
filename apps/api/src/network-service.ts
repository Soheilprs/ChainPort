import { getChainByKey } from "@chainport/chain-registry";
import { UniqueConstraintError, type PartnerRepository } from "@chainport/db";
import { parseAnalyticsRange, type EcosystemAnalytics } from "@chainport/ecosystem";
import {
  PartnerBrandingError,
  isAnalyticsAcquisitionFilter,
  parseDisplayName,
  parseId,
  parsePartnerSlug,
  type AnalyticsAcquisitionFilter,
  type NetworkPartnerStatus,
} from "@chainport/shared";

import { ApiRequestError } from "./errors.js";

export class NetworkService {
  public constructor(
    private readonly partners: PartnerRepository,
    private readonly analytics: EcosystemAnalytics,
  ) {}

  public async list() {
    const partners = await this.partners.list();
    return partners.filter((item) => !item.isDemo);
  }

  public async get(id: string) {
    return this.requirePartner(id);
  }

  public async create(body: unknown) {
    const input = asRecord(body);
    const networkKey = asString(input.networkKey, "networkKey");
    const chain = getChainByKey(networkKey);
    if (chain === undefined) {
      throw new ApiRequestError(400, "UNKNOWN_NETWORK", "networkKey is not in the registry");
    }
    if (chain.networkKind === "devnet" || networkKey === "anvil") {
      throw new ApiRequestError(400, "INVALID_NETWORK", "DEVNET chains cannot be network partners");
    }
    const displayName = parseName(input.displayName, chain.name);
    const status = parseStatus(input.status);
    try {
      return await this.partners.create({
        networkKey,
        displayName,
        ...(typeof input.slug === "string" ? { slug: parseSlug(input.slug) } : {}),
        ...(typeof input.organizationId === "string"
          ? { organizationId: parseId(input.organizationId, "organizationId") }
          : {}),
        ...(typeof input.organizationName === "string"
          ? { organizationName: input.organizationName }
          : {}),
        ...(status === undefined ? {} : { status }),
        isDemo: input.isDemo === true,
        logoUrl: optionalString(input.logoUrl),
        primaryAccent: optionalString(input.primaryAccent),
        shortDescription: optionalString(input.shortDescription),
        developerPortalEnabled:
          input.developerPortalEnabled === undefined ? true : input.developerPortalEnabled === true,
        docsUrl: optionalString(input.docsUrl),
        faucetUrl: optionalString(input.faucetUrl),
        explorerUrl: optionalString(input.explorerUrl),
        supportUrl: optionalString(input.supportUrl),
        discordUrl: optionalString(input.discordUrl),
        developerDocsUrl: optionalString(input.developerDocsUrl),
      });
    } catch (error) {
      return mapPartnerWriteError(error);
    }
  }

  public async update(id: string, body: unknown) {
    await this.requirePartner(id);
    const input = asRecord(body);
    if (input.networkKey !== undefined) {
      throw new ApiRequestError(
        400,
        "NETWORK_KEY_IMMUTABLE",
        "Partner networkKey is owned by the chain registry",
      );
    }
    const status = parseStatus(input.status);
    try {
      return await this.partners.update(id, {
        ...(typeof input.slug === "string" ? { slug: parseSlug(input.slug) } : {}),
        ...(input.displayName === undefined
          ? {}
          : { displayName: parseName(input.displayName, "") }),
        ...(status === undefined ? {} : { status }),
        ...(input.developerPortalEnabled === undefined
          ? {}
          : { developerPortalEnabled: input.developerPortalEnabled === true }),
        ...(input.logoUrl === undefined ? {} : { logoUrl: optionalString(input.logoUrl) }),
        ...(input.primaryAccent === undefined
          ? {}
          : { primaryAccent: optionalString(input.primaryAccent) }),
        ...(input.shortDescription === undefined
          ? {}
          : { shortDescription: optionalString(input.shortDescription) }),
        ...(input.docsUrl === undefined ? {} : { docsUrl: optionalString(input.docsUrl) }),
        ...(input.faucetUrl === undefined ? {} : { faucetUrl: optionalString(input.faucetUrl) }),
        ...(input.explorerUrl === undefined
          ? {}
          : { explorerUrl: optionalString(input.explorerUrl) }),
        ...(input.supportUrl === undefined ? {} : { supportUrl: optionalString(input.supportUrl) }),
        ...(input.discordUrl === undefined ? {} : { discordUrl: optionalString(input.discordUrl) }),
        ...(input.developerDocsUrl === undefined
          ? {}
          : { developerDocsUrl: optionalString(input.developerDocsUrl) }),
      });
    } catch (error) {
      return mapPartnerWriteError(error);
    }
  }

  public async overview(id: string, query: Record<string, unknown>) {
    const partner = await this.requirePartner(id);
    return this.analytics.overview(partner, this.queryOf(query));
  }

  public async funnel(id: string, query: Record<string, unknown>) {
    const partner = await this.requirePartner(id);
    return this.analytics.funnel(partner, this.queryOf(query));
  }

  public async projects(id: string, query: Record<string, unknown>) {
    const partner = await this.requirePartner(id);
    return this.analytics.projects(partner, this.queryOf(query));
  }

  public async project(id: string, projectId: string, query: Record<string, unknown>) {
    const partner = await this.requirePartner(id);
    const detail = await this.analytics.projectDetail(partner, projectId, this.queryOf(query));
    if (detail === undefined) {
      throw new ApiRequestError(
        404,
        "PROJECT_NOT_FOUND",
        "Project is not attributed to this partner",
      );
    }
    return detail;
  }

  public async blockers(id: string, query: Record<string, unknown>) {
    const partner = await this.requirePartner(id);
    return this.analytics.blockers(partner, this.queryOf(query));
  }

  public async gaps(id: string, query: Record<string, unknown>) {
    const partner = await this.requirePartner(id);
    return this.analytics.infrastructureGaps(partner, this.queryOf(query));
  }

  public async migrations(id: string, query: Record<string, unknown>) {
    const partner = await this.requirePartner(id);
    return this.analytics.migrations(partner, this.queryOf(query));
  }

  public async validations(id: string, query: Record<string, unknown>) {
    const partner = await this.requirePartner(id);
    return this.analytics.validations(partner, this.queryOf(query));
  }

  public async deployments(id: string, query: Record<string, unknown>) {
    const partner = await this.requirePartner(id);
    return this.analytics.deployments(partner, this.queryOf(query));
  }

  public async registry(id: string) {
    const partner = await this.requirePartner(id);
    return this.analytics.registry(partner);
  }

  public async insights(id: string, query: Record<string, unknown>) {
    const partner = await this.requirePartner(id);
    return this.analytics.insights(partner, this.queryOf(query));
  }

  public async unknownBacklog(id: string, query: Record<string, unknown>) {
    const partner = await this.requirePartner(id);
    return this.analytics.unknownBacklog(partner, this.queryOf(query));
  }

  private queryOf(query: Record<string, unknown>) {
    try {
      return {
        range: parseAnalyticsRange({
          ...(typeof query.range === "string" ? { range: query.range } : {}),
          ...(typeof query.from === "string" ? { from: query.from } : {}),
          ...(typeof query.to === "string" ? { to: query.to } : {}),
        }),
        includeInternal: query.includeInternal === "true" || query.includeInternal === true,
        includeDevnet: query.includeDevnet === "true" || query.includeDevnet === true,
        acquisition: parseAcquisition(query.acquisition),
      };
    } catch {
      throw new ApiRequestError(400, "INVALID_RANGE", "from/to must be ISO-8601 timestamps");
    }
  }

  private async requirePartner(id: string) {
    const partner = await this.partners.getById(id);
    if (partner === undefined) {
      throw new ApiRequestError(404, "PARTNER_NOT_FOUND", "Network partner not found");
    }
    return partner;
  }
}

function asRecord(body: unknown): Record<string, unknown> {
  if (body === undefined || body === null) {
    return {};
  }
  if (typeof body !== "object" || Array.isArray(body)) {
    throw new ApiRequestError(400, "INVALID_REQUEST", "Request body is invalid");
  }
  return body as Record<string, unknown>;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiRequestError(400, "INVALID_REQUEST", `${field} is required`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new ApiRequestError(400, "INVALID_REQUEST", "A string field is invalid");
  }
  return value;
}

function parseStatus(value: unknown): NetworkPartnerStatus | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "ACTIVE" || value === "PAUSED" || value === "PILOT" || value === "DISABLED") {
    return value;
  }
  throw new ApiRequestError(400, "INVALID_REQUEST", "status is invalid");
}

function parseAcquisition(value: unknown): AnalyticsAcquisitionFilter {
  if (value === undefined || value === "") {
    return "all";
  }
  if (isAnalyticsAcquisitionFilter(value)) {
    return value;
  }
  throw new ApiRequestError(400, "INVALID_REQUEST", "acquisition must be all, partner, or generic");
}

function parseSlug(value: string): string {
  try {
    return parsePartnerSlug(value);
  } catch (error) {
    return mapPartnerWriteError(error);
  }
}

function parseName(value: unknown, fallback: string): string {
  try {
    return parseDisplayName(value, fallback);
  } catch (error) {
    return mapPartnerWriteError(error);
  }
}

function mapPartnerWriteError(error: unknown): never {
  if (error instanceof PartnerBrandingError) {
    throw new ApiRequestError(400, error.code, error.message);
  }
  if (error instanceof UniqueConstraintError) {
    if (error.target.includes("slug")) {
      throw new ApiRequestError(409, "SLUG_EXISTS", "Partner slug is already in use");
    }
    throw new ApiRequestError(409, "PARTNER_EXISTS", "A partner already exists for this network");
  }
  throw error;
}
