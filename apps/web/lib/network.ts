import { API_URL } from "@/lib/api";

export interface NetworkPartner {
  id: string;
  organizationId: string;
  networkKey: string;
  displayName: string;
  status: string;
  isDemo: boolean;
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
): Promise<T | null> {
  const response = await fetch(
    `${API_URL}/v1/network-partners/${id}${path}?range=${encodeURIComponent(range)}`,
    { cache: "no-store" },
  ).catch(() => null);
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
