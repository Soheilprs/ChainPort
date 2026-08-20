import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PartnerLogo } from "@/components/partner-logo";
import { PartnerMigrationForm } from "@/components/partner-migration-form";
import { PhaseBanner } from "@/components/phase-banner";
import { SiteHeader } from "@/components/site-header";
import { fetchChains } from "@/lib/api";
import { fetchPublicPartner } from "@/lib/partners";

interface MigratePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: MigratePageProps): Promise<Metadata> {
  const { slug } = await params;
  const partner = await fetchPublicPartner(slug);
  if (partner === null || partner === "not_found") {
    return { title: "Start migration" };
  }
  return { title: `Migrate to ${partner.displayName}` };
}

export default async function PartnerMigratePage({ params }: MigratePageProps) {
  const { slug } = await params;
  const partner = await fetchPublicPartner(slug);
  if (partner === "not_found") {
    notFound();
  }
  if (partner === null) {
    return (
      <div>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-5 py-10">
          <p className="text-sm text-muted">API unavailable.</p>
        </main>
      </div>
    );
  }

  let chains: Awaited<ReturnType<typeof fetchChains>> = [];
  let loadError: string | null = null;
  try {
    chains = await fetchChains();
  } catch {
    loadError = "API unavailable";
  }

  return (
    <div style={{ ["--partner-accent" as string]: partner.primaryAccent }}>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <PhaseBanner />
        <Link
          href={`/partners/${partner.slug}`}
          className="mt-3 inline-block text-sm text-muted hover:text-foreground"
        >
          ← {partner.displayName} portal
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <PartnerLogo
            url={partner.logoUrl}
            name={partner.displayName}
            accent={partner.primaryAccent}
          />
          <div>
            <h1 className="text-2xl font-medium tracking-tight">
              Migrate to {partner.displayName}
            </h1>
            <p className="mt-1 text-sm text-muted">
              Source is yours to choose. Target is {partner.network.name}
              {partner.network.testnet !== null ? ` / ${partner.network.testnet.name}` : ""}.
            </p>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
          Connect a public GitHub repository. ChainPort reuses the existing ingest pipeline — there
          is no separate partner migration engine.
        </p>
        <div className="mt-8">
          {loadError !== null ? (
            <EmptyState title="API unavailable">
              The chain catalog could not be loaded, so a migration cannot be started.
            </EmptyState>
          ) : (
            <PartnerMigrationForm partner={partner} chains={chains} />
          )}
        </div>
        <p className="mt-8 text-xs text-muted">Powered by ChainPort</p>
      </main>
    </div>
  );
}
