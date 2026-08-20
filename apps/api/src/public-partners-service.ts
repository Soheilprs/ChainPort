import { getChainByKey, getOfficialDeploymentTestnet } from "@chainport/chain-registry";
import type { PartnerRepository } from "@chainport/db";
import {
  parsePartnerSlug,
  portalCreationEnabled,
  portalIsPubliclyVisible,
  PartnerBrandingError,
} from "@chainport/shared";

import { ApiRequestError } from "./errors.js";
import { presentPublicPartner } from "./presenters.js";
import type { ProjectsService } from "./projects-service.js";

export class PublicPartnerService {
  public constructor(
    private readonly partners: PartnerRepository,
    private readonly projects: ProjectsService,
  ) {}

  public async getBySlug(slugParam: string) {
    const partner = await this.requirePublicPartner(slugParam);
    return presentPublicPartner(partner, networkInfo(partner.networkKey));
  }

  public async createProject(slugParam: string, body: unknown) {
    const partner = await this.requirePublicPartner(slugParam);
    if (!portalCreationEnabled(partner)) {
      throw new ApiRequestError(
        409,
        "PARTNER_PORTAL_PAUSED",
        "This partner portal is not accepting new migrations",
      );
    }
    return this.projects.createFromPartner(partner, body);
  }

  private async requirePublicPartner(slugParam: string) {
    let slug: string;
    try {
      slug = parsePartnerSlug(slugParam);
    } catch (error) {
      if (error instanceof PartnerBrandingError) {
        throw new ApiRequestError(404, "PARTNER_NOT_FOUND", "Partner portal not found");
      }
      throw error;
    }
    const partner = await this.partners.getBySlug(slug);
    if (partner === undefined) {
      throw new ApiRequestError(404, "PARTNER_NOT_FOUND", "Partner portal not found");
    }
    if (!portalIsPubliclyVisible(partner)) {
      throw new ApiRequestError(404, "PORTAL_UNAVAILABLE", "Partner portal is unavailable");
    }
    return partner;
  }
}

function networkInfo(networkKey: string) {
  const chain = getChainByKey(networkKey);
  if (chain === undefined) {
    throw new ApiRequestError(500, "INTERNAL_ERROR", "Partner network is not in the registry");
  }
  const testnet = getOfficialDeploymentTestnet(networkKey);
  return {
    name: chain.name,
    chainId: chain.chainId,
    nativeCurrency: chain.nativeCurrency,
    testnet:
      testnet === undefined
        ? null
        : { key: testnet.key, name: testnet.name, chainId: testnet.chainId },
    explorerUrl: chain.explorers[0]?.url ?? testnet?.explorers[0]?.url ?? null,
    faucetUrl: testnet?.deployment?.faucetUrl ?? chain.deployment?.faucetUrl ?? null,
  };
}
