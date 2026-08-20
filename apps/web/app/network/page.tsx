import type { Metadata } from "next";
import Link from "next/link";

import { CreatePartnerForm } from "@/components/create-partner-form";
import { EmptyState } from "@/components/empty-state";
import { PhaseBanner } from "@/components/phase-banner";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { API_URL } from "@/lib/api";
import type { NetworkPartner } from "@/lib/network";

export const metadata: Metadata = {
  title: "Network console",
};

export default async function NetworkIndexPage() {
  const response = await fetch(`${API_URL}/v1/network-partners`, { cache: "no-store" }).catch(
    () => null,
  );
  const partners: NetworkPartner[] =
    response?.ok === true ? ((await response.json()) as { data: NetworkPartner[] }).data : [];

  return (
    <div>
      <SiteHeader current="/network" />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <PhaseBanner />
        <h1 className="mt-3 text-2xl font-medium tracking-tight">Network console</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Foundation console. Distinct from the public developer portal at /partners/:slug. Metrics
          are unique projects attributed by target chain, with an optional partner-referred filter.
          Internal test fixtures and Anvil DEVNET deployments are excluded.
        </p>

        {partners.length === 0 ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <EmptyState title="No network partners yet">
              Developer migration activity will appear here once a partner is created from a
              production chain in the registry. No sample values are shown.
            </EmptyState>
            <CreatePartnerForm />
          </div>
        ) : (
          <section className="mt-8 grid gap-3 md:grid-cols-2">
            {partners.map((partner) => (
              <Link key={partner.id} href={`/network/${partner.id}`}>
                <Card className="hover:border-line-strong">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>{partner.displayName}</CardTitle>
                    <Badge>{partner.status}</Badge>
                  </div>
                  <CardDescription>
                    {partner.networkKey}
                    {partner.slug ? ` · /partners/${partner.slug}` : ""}
                    {partner.isDemo ? " · DEMO" : ""}
                  </CardDescription>
                </Card>
              </Link>
            ))}
            <CreatePartnerForm />
          </section>
        )}
      </main>
    </div>
  );
}
