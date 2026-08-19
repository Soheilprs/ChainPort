import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getChainByKey, listChains } from "@chainport/chain-registry";

import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

interface ChainPageProps {
  params: Promise<{ key: string }>;
}

export function generateStaticParams() {
  return listChains().map((chain) => ({ key: chain.key }));
}

export async function generateMetadata({ params }: ChainPageProps): Promise<Metadata> {
  const { key } = await params;
  const chain = getChainByKey(key);
  return { title: chain?.name ?? "Chain" };
}

function statusTone(status: string): "pass" | "warning" | "blocker" | "default" {
  if (status === "available") {
    return "pass";
  }
  if (status === "partial") {
    return "warning";
  }
  if (status === "missing") {
    return "blocker";
  }
  return "default";
}

export default async function ChainDetailPage({ params }: ChainPageProps) {
  const { key } = await params;
  const chain = getChainByKey(key);
  if (chain === undefined) {
    notFound();
  }

  const groups = [
    { label: "Oracles", entries: chain.infrastructure.oracles },
    { label: "Bridges", entries: chain.infrastructure.bridges },
    { label: "Indexers", entries: chain.infrastructure.indexers },
    { label: "Verifiers", entries: chain.infrastructure.verifiers },
  ];

  return (
    <div>
      <SiteHeader current="/app/chains" />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <Link href="/app/chains" className="text-sm text-muted hover:text-foreground">
          ← Chain catalog
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-medium tracking-tight">{chain.name}</h1>
          {chain.roles.map((role) => (
            <Badge key={role}>{role}</Badge>
          ))}
        </div>
        <p className="mt-2 font-mono text-sm text-muted">
          {chain.key} · chain id {chain.chainId} · {chain.family} · {chain.networkKind}
        </p>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <Card>
            <CardTitle>EVM capabilities</CardTitle>
            <CardDescription>
              Declared execution characteristics used later for compatibility comparison.
            </CardDescription>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted">EVM version</dt>
                <dd className="mt-1">{chain.capabilities.evmVersion}</dd>
              </div>
              <div>
                <dt className="text-muted">EIP-1559</dt>
                <dd className="mt-1">{chain.capabilities.eip1559 ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt className="text-muted">PUSH0</dt>
                <dd className="mt-1">{chain.capabilities.push0 ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt className="text-muted">Transient storage</dt>
                <dd className="mt-1">{chain.capabilities.transientStorage ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt className="text-muted">MCOPY</dt>
                <dd className="mt-1">{chain.capabilities.mcopy ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt className="text-muted">Blob txs</dt>
                <dd className="mt-1">{chain.capabilities.blobTransactions ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt className="text-muted">CREATE2</dt>
                <dd className="mt-1">{chain.capabilities.create2 ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt className="text-muted">Precompiles</dt>
                <dd className="mt-1">{chain.capabilities.precompiles.length}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <CardTitle>Catalog endpoints</CardTitle>
            <CardDescription>
              These URLs come from public chain metadata. ChainPort does not operate them.
            </CardDescription>
            <ul className="mt-4 space-y-2 break-all font-mono text-xs text-muted-strong">
              {chain.rpcUrls.map((url) => (
                <li key={url}>{url}</li>
              ))}
            </ul>
            <ul className="mt-4 space-y-1 text-sm">
              {chain.explorers.map((explorer) => (
                <li key={explorer.url}>
                  <a href={explorer.url} className="text-accent hover:underline">
                    {explorer.name}
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section className="mt-4 grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.label}>
              <CardTitle>{group.label}</CardTitle>
              <ul className="mt-4 space-y-3">
                {group.entries.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm">{entry.name}</p>
                      {entry.notes !== undefined ? (
                        <p className="mt-1 text-xs leading-5 text-muted">{entry.notes}</p>
                      ) : null}
                    </div>
                    <Badge tone={statusTone(entry.status)}>{entry.status}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}
