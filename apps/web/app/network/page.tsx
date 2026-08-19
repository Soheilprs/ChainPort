import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { PhaseBanner } from "@/components/phase-banner";
import { SiteHeader } from "@/components/site-header";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Network console",
};

const stats = [
  { label: "Projects analyzed", value: "—" },
  { label: "Compatibility rate", value: "—" },
  { label: "Testnet deployments", value: "—" },
  { label: "Open blockers", value: "—" },
] as const;

export default function NetworkPage() {
  return (
    <div>
      <SiteHeader current="/network" />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <PhaseBanner />
        <h1 className="mt-3 text-2xl font-medium tracking-tight">Network console</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          For foundations, ecosystem teams, and RaaS providers. Metrics stay empty until real
          analyses exist.
        </p>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="py-4">
              <p className="text-xs uppercase tracking-wide text-muted">{stat.label}</p>
              <p className="mt-2 text-2xl font-medium">{stat.value}</p>
            </Card>
          ))}
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <EmptyState title="Common developer blockers">
            Blockers will aggregate from real findings once the scanner and compatibility engine
            run. This surface will not show sample incompatibilities.
          </EmptyState>
          <EmptyState title="Missing infrastructure">
            Missing oracles, bridges, indexers, and verifiers will be ranked by how many
            applications they unblock. No ranking is available yet.
          </EmptyState>
        </section>

        <Card className="mt-4">
          <CardTitle>Who this is for</CardTitle>
          <CardDescription>
            The paying customer is the blockchain network, foundation, ecosystem team, or RaaS
            provider. Developers use the migration tooling that partner networks expose.
          </CardDescription>
        </Card>
      </main>
    </div>
  );
}
