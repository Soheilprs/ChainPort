import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ExternalLink } from "@/components/external-link";
import { PartnerLogo } from "@/components/partner-logo";
import { PhaseBanner } from "@/components/phase-banner";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { fetchPublicPartner, PARTNER_LINK_LABELS } from "@/lib/partners";

interface PartnerLandingProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PartnerLandingProps): Promise<Metadata> {
  const { slug } = await params;
  const partner = await fetchPublicPartner(slug);
  if (partner === null || partner === "not_found") {
    return { title: "Partner portal" };
  }
  return { title: `${partner.displayName} × ChainPort` };
}

export default async function PartnerLandingPage({ params }: PartnerLandingProps) {
  const { slug } = await params;
  const partner = await fetchPublicPartner(slug);
  if (partner === "not_found") {
    notFound();
  }
  if (partner === null) {
    return (
      <div>
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-5 py-10">
          <p className="text-sm text-muted">API unavailable.</p>
        </main>
      </div>
    );
  }

  const steps = [
    "Analyze compatibility",
    "Identify migration requirements",
    "Generate safe changes",
    "Validate the migrated project",
    "Prepare testnet deployment",
  ];
  const linkEntries = Object.entries(partner.links).filter(([, href]) => href.length > 0);

  return (
    <div style={{ ["--partner-accent" as string]: partner.primaryAccent }}>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-10">
        <PhaseBanner />
        <section className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start">
          <PartnerLogo
            url={partner.logoUrl}
            name={partner.displayName}
            accent={partner.primaryAccent}
            size="lg"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-medium tracking-tight">
                {partner.displayName} × ChainPort
              </h1>
              {partner.portal.pilot ? <Badge tone="warning">Pilot</Badge> : null}
              {partner.portal.paused ? <Badge tone="warning">Paused</Badge> : null}
            </div>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
              {partner.shortDescription ??
                `Migrate your EVM application to ${partner.displayName}. Connect an existing public GitHub repository and ChainPort will analyze compatibility, plan required changes, and prepare an official testnet deployment.`}
            </p>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <Card>
            <CardTitle>What ChainPort does</CardTitle>
            <CardDescription>
              Manual or unknown blockers can remain. This is not a one-click migration.
            </CardDescription>
            <ol className="mt-4 space-y-2 text-sm text-muted">
              {steps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="w-4 shrink-0 font-mono text-xs text-muted-strong">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </Card>
          <Card>
            <CardTitle>Network</CardTitle>
            <dl className="mt-4 space-y-2 text-sm">
              <Info label="Network" value={partner.network.name} />
              <Info label="Chain ID" value={String(partner.network.chainId)} />
              <Info
                label="Native currency"
                value={`${partner.network.nativeCurrency.symbol} (${partner.network.nativeCurrency.name})`}
              />
              <Info
                label="Official testnet"
                value={
                  partner.network.testnet === null
                    ? "Not configured"
                    : `${partner.network.testnet.name} (${partner.network.testnet.chainId})`
                }
              />
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Target</dt>
                <dd>{partner.network.name} — locked</dd>
              </div>
            </dl>
          </Card>
        </section>

        {linkEntries.length > 0 ? (
          <section className="mt-4">
            <Card>
              <CardTitle>Network resources</CardTitle>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {linkEntries.map(([key, href]) => (
                  <li key={key}>
                    <ExternalLink href={href}>{PARTNER_LINK_LABELS[key] ?? key}</ExternalLink>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ) : null}

        <section className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          {partner.portal.creationEnabled ? (
            <Link
              href={`/partners/${partner.slug}/migrate`}
              className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-white"
              style={{ backgroundColor: partner.primaryAccent }}
            >
              Start migration
            </Link>
          ) : (
            <p className="text-sm text-warning">
              New migrations are paused for this network. Existing developer projects are unchanged.
            </p>
          )}
          <p className="text-xs text-muted">
            Powered by ChainPort. Public GitHub repositories only.
          </p>
        </section>
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
