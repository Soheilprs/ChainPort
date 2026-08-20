import { API_URL } from "@/lib/api";

export interface PublicPartnerNetwork {
  name: string;
  chainId: number;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  testnet: { key: string; name: string; chainId: number } | null;
  explorerUrl: string | null;
  faucetUrl: string | null;
}

export interface PublicPartner {
  slug: string;
  displayName: string;
  networkKey: string;
  network: PublicPartnerNetwork;
  logoUrl: string | null;
  primaryAccent: string;
  shortDescription: string | null;
  status: string;
  portal: {
    enabled: boolean;
    creationEnabled: boolean;
    pilot: boolean;
    paused: boolean;
  };
  links: Record<string, string>;
}

export async function fetchPublicPartner(
  slug: string,
): Promise<PublicPartner | "not_found" | null> {
  const response = await fetch(`${API_URL}/v1/public/partners/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  }).catch(() => null);
  if (response === null) {
    return null;
  }
  if (response.status === 404) {
    return "not_found";
  }
  if (!response.ok) {
    throw new Error("Unable to load partner portal");
  }
  const body = (await response.json()) as { data: PublicPartner };
  return body.data;
}

export const PARTNER_LINK_LABELS: Record<string, string> = {
  docs: "Documentation",
  developerDocs: "Developer docs",
  explorer: "Explorer",
  faucet: "Faucet",
  support: "Support",
  discord: "Discord",
};
