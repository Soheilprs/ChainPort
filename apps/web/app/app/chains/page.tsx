import type { Metadata } from "next";
import Link from "next/link";

import { listChains } from "@chainport/chain-registry";

import { AppNav } from "@/components/app-nav";
import { PhaseBanner } from "@/components/phase-banner";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Chains",
};

export default function ChainsPage() {
  const chains = listChains();

  return (
    <div>
      <SiteHeader current="/app/chains" />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <PhaseBanner />
        <h1 className="mt-3 text-2xl font-medium tracking-tight">Chain catalog</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Source and target networks known to ChainPort. Public RPC URLs are catalog metadata, not a
          hosted RPC service.
        </p>
        <div className="mt-8">
          <AppNav current="/app/chains" />
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Network</th>
                  <th className="px-4 py-3 font-medium">Chain ID</th>
                  <th className="px-4 py-3 font-medium">Family</th>
                  <th className="px-4 py-3 font-medium">Kind</th>
                  <th className="px-4 py-3 font-medium">Roles</th>
                </tr>
              </thead>
              <tbody>
                {chains.map((chain) => (
                  <tr key={chain.key} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/app/chains/${chain.key}`} className="hover:text-accent">
                        {chain.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-strong">
                      {chain.chainId}
                    </td>
                    <td className="px-4 py-3 text-muted">{chain.family}</td>
                    <td className="px-4 py-3 text-muted">{chain.networkKind}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {chain.roles.map((role) => (
                          <Badge key={role}>{role}</Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
