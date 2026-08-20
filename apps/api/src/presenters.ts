import type {
  JobStatusEvent,
  MigrationJob,
  NetworkPartner,
  Project,
  Repository,
} from "@chainport/shared";
import { presentPartnerLinks, resolvePartnerAccent } from "@chainport/shared";

export function presentProject(
  project: Project,
  partner?: Pick<NetworkPartner, "slug" | "displayName" | "networkKey"> | null,
) {
  return {
    id: project.id,
    name: project.name,
    repositoryId: project.repositoryId,
    githubOwner: project.githubOwner,
    githubRepo: project.githubRepo,
    githubUrl: project.githubUrl,
    status: project.status,
    activeRevisionId: project.activeRevisionId,
    networkPartnerId: project.networkPartnerId,
    acquisitionSource: project.acquisitionSource,
    partner:
      partner === undefined || partner === null
        ? null
        : {
            slug: partner.slug,
            displayName: partner.displayName,
            networkKey: partner.networkKey,
          },
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export function presentNetworkPartner(partner: NetworkPartner) {
  return {
    id: partner.id,
    organizationId: partner.organizationId,
    networkKey: partner.networkKey,
    slug: partner.slug,
    displayName: partner.displayName,
    status: partner.status,
    isDemo: partner.isDemo,
    logoUrl: partner.logoUrl,
    primaryAccent: partner.primaryAccent,
    resolvedAccent: resolvePartnerAccent(partner.primaryAccent),
    shortDescription: partner.shortDescription,
    developerPortalEnabled: partner.developerPortalEnabled,
    docsUrl: partner.docsUrl,
    faucetUrl: partner.faucetUrl,
    explorerUrl: partner.explorerUrl,
    supportUrl: partner.supportUrl,
    discordUrl: partner.discordUrl,
    developerDocsUrl: partner.developerDocsUrl,
    createdAt: partner.createdAt.toISOString(),
    updatedAt: partner.updatedAt.toISOString(),
  };
}

export function presentPublicPartner(
  partner: NetworkPartner,
  network: {
    name: string;
    chainId: number;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    testnet: { key: string; name: string; chainId: number } | null;
    explorerUrl: string | null;
    faucetUrl: string | null;
  },
) {
  const links = presentPartnerLinks(partner);
  const explorer = links.explorer ?? network.explorerUrl;
  const faucet = links.faucet ?? network.faucetUrl;
  return {
    slug: partner.slug,
    displayName: partner.displayName,
    networkKey: partner.networkKey,
    network,
    logoUrl: partner.logoUrl,
    primaryAccent: resolvePartnerAccent(partner.primaryAccent),
    shortDescription: partner.shortDescription,
    status: partner.status,
    portal: {
      enabled: true,
      creationEnabled: partner.status === "ACTIVE" || partner.status === "PILOT",
      pilot: partner.status === "PILOT",
      paused: partner.status === "PAUSED",
    },
    links: {
      ...links,
      ...(explorer === undefined || explorer === null ? {} : { explorer }),
      ...(faucet === undefined || faucet === null ? {} : { faucet }),
    },
  };
}

export function presentRepository(repository: Repository) {
  return {
    id: repository.id,
    provider: repository.provider,
    owner: repository.owner,
    name: repository.name,
    normalizedUrl: repository.normalizedUrl,
    defaultBranch: repository.defaultBranch,
    resolvedCommitSha: repository.resolvedCommitSha,
    cloneStatus: repository.cloneStatus,
    clonedAt: repository.clonedAt?.toISOString() ?? null,
    sizeBytes: repository.sizeBytes,
  };
}

export function presentJob(job: MigrationJob) {
  return {
    id: job.id,
    projectId: job.projectId,
    repositoryId: job.repositoryId,
    sourceChainKey: job.sourceChainKey,
    targetChainKey: job.targetChainKey,
    status: job.status,
    repoSha: job.repoSha,
    attempt: job.attempt,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
  };
}

export function presentEvent(event: JobStatusEvent) {
  return {
    id: event.id,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    reason: event.reason,
    createdAt: event.createdAt.toISOString(),
  };
}
