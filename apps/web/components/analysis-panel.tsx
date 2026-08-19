"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { API_URL } from "@/lib/api";

export function AnalyzeButton({
  projectId,
  ingestComplete,
}: {
  projectId: string;
  ingestComplete: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onClick() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`${API_URL}/v1/projects/${projectId}/analyses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = (await response.json()) as {
        data?: { id: string };
        message?: string;
        code?: string;
      };
      if (!response.ok || body.data?.id === undefined) {
        setError(body.code ?? "Unable to start analysis");
        return;
      }
      router.push(`/app/analyses/${body.data.id}`);
    } catch {
      setError("API unavailable");
    } finally {
      setPending(false);
    }
  }

  if (!ingestComplete) {
    return <p className="text-sm text-muted">Ingest must complete before analysis can start.</p>;
  }

  return (
    <div className="space-y-2">
      <Button onClick={() => void onClick()} disabled={pending}>
        {pending ? "Starting…" : "Analyze repository"}
      </Button>
      {error !== null ? <p className="text-sm text-blocker">{error}</p> : null}
      <p className="text-xs text-muted">
        Analysis inspects the stored commit SHA only. It does not compare the target chain.
      </p>
      <Link href={`/app/projects/${projectId}`} className="hidden" />
    </div>
  );
}
