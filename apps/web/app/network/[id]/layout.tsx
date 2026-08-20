import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { NetworkNav } from "@/components/network-nav";
import { PhaseBanner } from "@/components/phase-banner";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { API_URL } from "@/lib/api";
import type { NetworkPartner } from "@/lib/network";

export default async function NetworkPartnerLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const response = await fetch(`${API_URL}/v1/network-partners/${id}`, { cache: "no-store" }).catch(
    () => null,
  );
  if (response === null) {
    return (
      <div>
        <SiteHeader current="/network" />
        <main className="mx-auto max-w-6xl px-5 py-10">
          <p className="text-sm text-muted">API unavailable.</p>
        </main>
      </div>
    );
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
    <div>
      <SiteHeader current="/network" />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <PhaseBanner />
        <Link
          href="/network"
          className="mt-3 inline-block text-sm text-muted hover:text-foreground"
        >
          ← Networks
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-medium tracking-tight">{partner.displayName}</h1>
          <Badge>{partner.status}</Badge>
          {partner.isDemo ? <Badge tone="warning">DEMO</Badge> : null}
        </div>
        <p className="mt-2 font-mono text-sm text-muted">{partner.networkKey}</p>
        <div className="mt-6">
          <NetworkNav partnerId={id} />
        </div>
        {children}
      </main>
    </div>
  );
}
