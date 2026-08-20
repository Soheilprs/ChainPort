import { API_URL } from "@/lib/api";

export interface NetworkPartner {
  id: string;
  organizationId: string;
  networkKey: string;
  slug: string;
  displayName: string;
  status: string;
  isDemo: boolean;
  logoUrl: string | null;
  primaryAccent: string | null;
  resolvedAccent: string;
  shortDescription: string | null;
  developerPortalEnabled: boolean;
  docsUrl: string | null;
  faucetUrl: string | null;
  explorerUrl: string | null;
  supportUrl: string | null;
  discordUrl: string | null;
  developerDocsUrl: string | null;
}

export async function fetchPartners(): Promise<NetworkPartner[]> {
  const response = await fetch(`${API_URL}/v1/network-partners`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to load network partners");
  }
  const body = (await response.json()) as { data: NetworkPartner[] };
  return body.data;
}

export async function fetchPartnerJson<T>(
  id: string,
  path: string,
  range = "all",
  acquisition = "all",
): Promise<T | null> {
  const query = new URLSearchParams({ range, acquisition });
  const response = await fetch(`${API_URL}/v1/network-partners/${id}${path}?${query.toString()}`, {
    cache: "no-store",
  }).catch(() => null);
  if (response === null || response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error("Unable to load network analytics");
  }
  const body = (await response.json()) as { data: T };
  return body.data;
}

export function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "N/A";
  }
  return `${(value * 100).toFixed(1)}%`;
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return String(value);
}
