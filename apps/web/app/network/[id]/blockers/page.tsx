import type { Metadata } from "next";
import { Suspense } from "react";

import { EmptyState } from "@/components/empty-state";
import { RangeSelect } from "@/components/range-select";
import { Card, CardTitle } from "@/components/ui/card";
import { fetchPartnerJson } from "@/lib/network";

export const metadata: Metadata = { title: "Blockers" };

interface Row {
  key: string;
  ruleId: string;
  title: string;
  affectedProjects: number;
  blockerProjects: number;
  warningProjects: number;
  unknownProjects: number;
}

export default async function BlockersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { id } = await params;
  const { range = "all" } = await searchParams;
  const rows = await fetchPartnerJson<Row[]>(id, "/blockers", range);
  if (rows === null) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Suspense>
          <RangeSelect current={range} />
        </Suspense>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No aggregated blockers">PASS findings are excluded.</EmptyState>
      ) : (
        <Card>
          <CardTitle>Normalized blockers</CardTitle>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted">
                <tr>
                  <th className="py-2">Capability</th>
                  <th>Projects</th>
                  <th>Blocker</th>
                  <th>Warning</th>
                  <th>Unknown</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-t border-line">
                    <td className="max-w-md py-2">
                      <p className="break-all">{row.title}</p>
                      <p className="font-mono text-xs text-muted">{row.key}</p>
                    </td>
                    <td>{row.affectedProjects}</td>
                    <td>{row.blockerProjects}</td>
                    <td>{row.warningProjects}</td>
                    <td>{row.unknownProjects}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
