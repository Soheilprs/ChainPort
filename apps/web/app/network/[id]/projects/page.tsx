import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyState } from "@/components/empty-state";
import { RangeSelect } from "@/components/range-select";
import { Badge } from "@/components/ui/badge";
import { fetchPartnerJson } from "@/lib/network";

export const metadata: Metadata = { title: "Network projects" };

interface Row {
  id: string;
  name: string;
  githubOwner: string;
  githubRepo: string;
  sourceChainKey: string;
  targetChainKey: string;
  stage: string;
  compatibilityReadiness: string | null;
  validationOutcome: string | null;
  deploymentStatus: string | null;
  lastActivityAt: string;
}

export default async function NetworkProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { id } = await params;
  const { range = "all" } = await searchParams;
  const rows = await fetchPartnerJson<Row[]>(id, "/projects", range);
  if (rows === null) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Suspense>
          <RangeSelect current={range} />
        </Suspense>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No attributed projects">
          Projects appear after a developer starts a migration whose target chain matches this
          partner.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">Repository</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2">Compatibility</th>
                <th className="px-3 py-2">Validation</th>
                <th className="px-3 py-2">Deployment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line/70">
                  <td className="max-w-[18rem] px-3 py-2">
                    <Link
                      className="break-all hover:text-accent"
                      href={`/network/${id}/projects/${row.id}`}
                    >
                      {row.githubOwner}/{row.githubRepo}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row.sourceChainKey}</td>
                  <td className="px-3 py-2">
                    <Badge>{row.stage.replaceAll("_", " ")}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs">{row.compatibilityReadiness ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{row.validationOutcome ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{row.deploymentStatus ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
