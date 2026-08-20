import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PartnerSettingsForm } from "@/components/partner-settings-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { API_URL } from "@/lib/api";
import type { NetworkPartner } from "@/lib/network";

export const metadata: Metadata = { title: "Partner settings" };

export default async function PartnerSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const response = await fetch(`${API_URL}/v1/network-partners/${id}`, { cache: "no-store" }).catch(
    () => null,
  );
  if (response === null) {
    return <p className="text-sm text-muted">API unavailable.</p>;
  }
  if (response.status === 404) {
    notFound();
  }
  if (!response.ok) {
    throw new Error("Unable to load partner");
  }
  const body = (await response.json()) as { data: NetworkPartner };
  const partner = body.data;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <Card>
        <CardTitle>Partner settings</CardTitle>
        <CardDescription>
          Branding and portal links. Technical registry capabilities stay in the chain catalog.
        </CardDescription>
        <div className="mt-5">
          <PartnerSettingsForm partner={partner} />
        </div>
      </Card>
      <Card>
        <CardTitle>Developer portal</CardTitle>
        <CardDescription>
          Preview renders the live partner configuration. No sample analytics are shown.
        </CardDescription>
        {partner.developerPortalEnabled && partner.status !== "DISABLED" ? (
          <Link
            href={`/partners/${partner.slug}`}
            className="mt-4 inline-flex h-9 items-center rounded-md border border-line-strong px-3 text-sm hover:bg-surface"
          >
            Preview developer portal
          </Link>
        ) : (
          <p className="mt-4 text-sm text-muted">Portal is unavailable in the current status.</p>
        )}
        <p className="mt-3 break-all font-mono text-xs text-muted">/partners/{partner.slug}</p>
      </Card>
    </div>
  );
}
