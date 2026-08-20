import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { fetchPartnerJson, formatCount } from "@/lib/network";

export const metadata: Metadata = { title: "Network registry" };

interface Payload {
  chain: { key: string; name: string; chainId: number; networkKind: string };
  deploymentTestnet: { key: string; name: string; chainId: number } | null;
  tokens: { available: number; unavailable: number; unknown: number };
  protocols: { available: number; unavailable: number; unknown: number };
  feeds: { available: number; unavailable: number; unknown: number };
  rpcMethods: { available: number; unavailable: number; unknown: number };
  items: {
    tokens: Array<{ id: string; availability: string; provenance: string }>;
    protocols: Array<{ id: string; availability: string; provenance: string }>;
  };
}

export default async function RegistryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchPartnerJson<Payload>(id, "/registry");
  if (data === null) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>{data.chain.name}</CardTitle>
        <CardDescription>
          {data.chain.key} · chain id {data.chain.chainId} · {data.chain.networkKind}
          {data.deploymentTestnet
            ? ` · official testnet ${data.deploymentTestnet.name}`
            : " · no official testnet configured"}
        </CardDescription>
      </Card>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Coverage title="Tokens" stats={data.tokens} />
        <Coverage title="Protocols" stats={data.protocols} />
        <Coverage title="Feeds" stats={data.feeds} />
        <Coverage title="RPC methods" stats={data.rpcMethods} />
      </section>
      <Card>
        <CardTitle>Tokens</CardTitle>
        <ul className="mt-3 space-y-2 text-sm">
          {data.items.tokens.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span className="font-mono">{item.id}</span>
              <span>
                <Badge>{item.availability}</Badge>{" "}
                <span className="text-xs text-muted">{item.provenance}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardTitle>Protocols</CardTitle>
        <ul className="mt-3 space-y-2 text-sm">
          {data.items.protocols.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span className="font-mono">{item.id}</span>
              <span>
                <Badge>{item.availability}</Badge>{" "}
                <span className="text-xs text-muted">{item.provenance}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Coverage({
  title,
  stats,
}: {
  title: string;
  stats: { available: number; unavailable: number; unknown: number };
}) {
  return (
    <Card className="py-4">
      <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
      <p className="mt-2 text-sm">
        {formatCount(stats.available)} available · {formatCount(stats.unavailable)} unavailable ·{" "}
        {formatCount(stats.unknown)} unknown
      </p>
    </Card>
  );
}
