import Link from "next/link";

import {
  PRODUCT_IS_NOT,
  PRODUCT_PRINCIPLE,
  PRODUCT_QUESTION,
  PRODUCT_TAGLINE,
} from "@chainport/shared";

import { PhaseBanner } from "@/components/phase-banner";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

const developerSteps = [
  "Connect a GitHub repository",
  "Select source and target chains",
  "Analyze contracts, config, and protocol assumptions",
  "Compare requirements against target capabilities",
  "Produce PASS / WARNING / BLOCKER findings",
  "Plan, patch, sandbox, and verify on testnet",
];

const networkNeeds = [
  "Projects analyzed",
  "Compatibility rates",
  "Testnet deployments",
  "Common developer blockers",
  "Missing infrastructure",
  "Highest-leverage integrations",
];

export default function HomePage() {
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-16">
        <section className="max-w-3xl">
          <PhaseBanner />
          <h1 className="mt-4 text-4xl font-medium tracking-tight sm:text-5xl">
            Move existing EVM apps onto new chains — safely.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted">{PRODUCT_TAGLINE}.</p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-strong">{PRODUCT_QUESTION}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/app/projects"
              className="inline-flex h-9 items-center rounded-md bg-foreground px-3.5 text-sm font-medium text-background"
            >
              Developer workspace
            </Link>
            <Link
              href="/network"
              className="inline-flex h-9 items-center rounded-md border border-line-strong px-3.5 text-sm text-foreground hover:bg-surface"
            >
              Network console
            </Link>
          </div>
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-2">
          <Card>
            <Badge>Developers</Badge>
            <CardTitle className="mt-4">Port an application</CardTitle>
            <CardDescription>
              Submit a public GitHub URL, ingest the SHA, analyze requirements, evaluate target
              compatibility, plan the migration, and review deterministic safe patches. Sandbox
              validation is not implemented in this phase.
            </CardDescription>
            <ol className="mt-5 space-y-2 text-sm text-muted">
              {developerSteps.map((step, index) => (
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
            <Badge>Networks</Badge>
            <CardTitle className="mt-4">See what blocks adoption</CardTitle>
            <CardDescription>
              Foundations, ecosystem teams, and RaaS providers are the paying customer. The console
              is present, but there are no analyses yet.
            </CardDescription>
            <ul className="mt-5 space-y-2 text-sm text-muted">
              {networkNeeds.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <Card>
            <CardTitle>Finding model</CardTitle>
            <CardDescription>
              Every later analysis writes PASS, WARNING, or BLOCKER findings with evidence. Nothing
              is scored without a recorded reason.
            </CardDescription>
            <div className="mt-4 flex gap-2">
              <Badge tone="pass">Pass</Badge>
              <Badge tone="warning">Warning</Badge>
              <Badge tone="blocker">Blocker</Badge>
            </div>
          </Card>
          <Card>
            <CardTitle>Product principle</CardTitle>
            <CardDescription>
              {PRODUCT_PRINCIPLE} Public RPC URLs in the catalog are metadata only — ChainPort is
              not an RPC provider.
            </CardDescription>
          </Card>
          <Card>
            <CardTitle>Not this product</CardTitle>
            <CardDescription>
              ChainPort is not {PRODUCT_IS_NOT.slice(0, -1).join(", ")}, or {PRODUCT_IS_NOT.at(-1)}.
            </CardDescription>
          </Card>
        </section>
      </main>
    </div>
  );
}
