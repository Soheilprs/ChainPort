import type { Metadata } from "next";
import Link from "next/link";

import { NewMigrationForm } from "@/components/new-migration-form";
import { PhaseBanner } from "@/components/phase-banner";
import { SiteHeader } from "@/components/site-header";
import { EmptyState } from "@/components/empty-state";
import { fetchChains } from "@/lib/api";

export const metadata: Metadata = {
  title: "New migration",
};

export default async function NewMigrationPage({
  searchParams,
}: {
  searchParams: Promise<{ repositoryUrl?: string }>;
}) {
  const params = await searchParams;
  let chains: Awaited<ReturnType<typeof fetchChains>> = [];
  let loadError: string | null = null;
  try {
    chains = await fetchChains();
  } catch {
    loadError = "API unavailable";
  }

  return (
    <div>
      <SiteHeader current="/app/projects" />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <PhaseBanner />
        <Link
          href="/app/projects"
          className="mt-3 inline-block text-sm text-muted hover:text-foreground"
        >
          ← Projects
        </Link>
        <h1 className="mt-3 text-2xl font-medium tracking-tight">New migration</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Public GitHub repositories only. ChainPort will validate the URL, queue an ingest job, and
          clone into an isolated workspace without executing repository code.
        </p>
        <div className="mt-8">
          {loadError !== null ? (
            <EmptyState title="API unavailable">
              The chain catalog could not be loaded, so a migration cannot be started.
            </EmptyState>
          ) : (
            <NewMigrationForm chains={chains} initialRepositoryUrl={params.repositoryUrl ?? ""} />
          )}
        </div>
      </main>
    </div>
  );
}
